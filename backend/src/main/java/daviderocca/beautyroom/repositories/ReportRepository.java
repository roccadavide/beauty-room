package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.enums.ClientPackageStatus;
import daviderocca.beautyroom.enums.ClientPackagePaymentMode;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.OrderStatus;
import daviderocca.beautyroom.enums.PackageCreditStatus;
import daviderocca.beautyroom.enums.PaymentMethod;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Cash-basis revenue extraction for the admin report. Every method returns RAW VALUED
 * ROWS — one row per money event, carrying (collection date, amount, channel, client
 * identity) — and the {@link daviderocca.beautyroom.services.ReportService} does all
 * the bucketing/summing in Java. This keeps the mutual-exclusivity partition explicit
 * and testable, and avoids GROUP-BY-on-date-function portability gaps between Postgres
 * and the H2 test DB.
 *
 * <p>Native SQL is used ONLY where the {@code booking_services} join table's extra
 * columns ({@code price_override}, {@code option_id}, {@code paid}) are needed — those
 * columns are not JPA-mapped (the {@code @ManyToMany} only maps the service association),
 * so JPQL cannot read them. Everything else is JPQL (portable, type-safe). All native
 * SQL is H2-PostgreSQL-mode safe (no {@code ::} casts, no {@code regexp_replace}, no
 * {@code date_trunc}). No emoji ever appears in a query string (a known Hibernate
 * landmine).
 *
 * <p>The per-booking treatment amount mirrors the proven arretrati union
 * ({@code BookingRepository.findArretratiForCustomer}), inverted to "collected":
 * {@code COALESCE(custom_total_price, Σ effective paid line prices)} where an effective
 * line price is {@code COALESCE(price_override, serviceOption.price, service.price)}.
 * For ONLINE bookings (fully charged at paidAt) every line counts; for IN-STORE
 * bookings only paid lines count (true cash-basis). A booking that is packageCredit-,
 * ledger-mode- or promo-backed contributes €0 here (its money lives in another leg).
 */
@Repository
public class ReportRepository {

    @PersistenceContext
    private EntityManager em;

    // ---- Shared native SQL fragments (alias `b` = bookings) -----------------------

    /**
     * Mutual-exclusivity exclusions: a treatment-leg booking must NOT be packageCredit-
     * backed (online package session), ledger-mode-backed (admin UPFRONT/INSTALLMENTS —
     * counted in the packages leg) or promo-backed (counted in the promotions leg).
     * Mirrors the ledger-mode exclusion the old report already had.
     */
    private static final String EXCL =
            " b.package_credit_id IS NULL "
          + " AND NOT EXISTS (SELECT 1 FROM booking_package_link bpl "
          + "   JOIN client_package_assignments cpa ON cpa.id = bpl.client_package_assignment_id "
          + "   WHERE bpl.booking_id = b.booking_id AND cpa.payment_mode IN ('UPFRONT','INSTALLMENTS')) "
          + " AND NOT EXISTS (SELECT 1 FROM booking_promotion_link bplx WHERE bplx.booking_id = b.booking_id) ";

    /** Collection date: online → paidAt; in-store → settled_at (fallback completedAt). */
    private static final String COLL =
            "CASE WHEN b.payment_method = 'PAID_ONLINE' THEN b.paid_at "
          + "     ELSE COALESCE(b.settled_at, b.completed_at) END";

    /** Per-booking collected treatment amount (see class javadoc). */
    private static final String TREAT_AMT =
            "CASE WHEN b.custom_total_price IS NOT NULL THEN "
          + "  CASE WHEN (b.payment_method = 'PAID_ONLINE' AND b.paid_at IS NOT NULL) "
          + "         OR (b.payment_method <> 'PAID_ONLINE' AND b.settled_at IS NOT NULL) "
          + "       THEN b.custom_total_price ELSE 0 END "
          + "ELSE ( "
          + "  COALESCE((SELECT SUM(COALESCE(bs.price_override, so.price, s.price)) "
          + "            FROM booking_services bs "
          + "            LEFT JOIN services s ON s.service_id = bs.service_id "
          + "            LEFT JOIN service_options so ON so.option_id = bs.option_id "
          + "            WHERE bs.booking_id = b.booking_id "
          + "              AND (b.payment_method = 'PAID_ONLINE' OR bs.paid = true)), 0) "
          + "  + CASE WHEN b.is_custom_service = true "
          + "           AND (b.payment_method = 'PAID_ONLINE' OR b.custom_service_paid = true) "
          + "         THEN COALESCE(b.custom_service_price, 0) ELSE 0 END "
          + "  + CASE WHEN b.service_id IS NOT NULL AND b.is_custom_service = false "
          + "           AND NOT EXISTS (SELECT 1 FROM booking_services bs2 WHERE bs2.booking_id = b.booking_id) "
          + "           AND (b.payment_method = 'PAID_ONLINE' OR b.paid_in_store = true) "
          + "         THEN COALESCE((SELECT so2.price FROM service_options so2 WHERE so2.option_id = b.service_option_id), "
          + "                       (SELECT s2.price FROM services s2 WHERE s2.service_id = b.service_id), 0) "
          + "         ELSE 0 END "
          + ") END";

    /** Expected (pipeline) amount: same surface as TREAT_AMT but with NO paid gate. */
    private static final String PIPE_AMT =
            "COALESCE(b.custom_total_price, ( "
          + "  COALESCE((SELECT SUM(COALESCE(bs.price_override, so.price, s.price)) "
          + "            FROM booking_services bs "
          + "            LEFT JOIN services s ON s.service_id = bs.service_id "
          + "            LEFT JOIN service_options so ON so.option_id = bs.option_id "
          + "            WHERE bs.booking_id = b.booking_id), 0) "
          + "  + CASE WHEN b.is_custom_service = true THEN COALESCE(b.custom_service_price, 0) ELSE 0 END "
          + "  + CASE WHEN b.service_id IS NOT NULL AND b.is_custom_service = false "
          + "           AND NOT EXISTS (SELECT 1 FROM booking_services bs2 WHERE bs2.booking_id = b.booking_id) "
          + "         THEN COALESCE((SELECT so2.price FROM service_options so2 WHERE so2.option_id = b.service_option_id), "
          + "                       (SELECT s2.price FROM services s2 WHERE s2.service_id = b.service_id), 0) "
          + "         ELSE 0 END "
          + ") )";

    /**
     * Display service name for an upcoming booking: the custom line name when custom,
     * else the principal service title, else the first multi-service line title (MIN keeps
     * it single-valued for multi-line bookings), else a generic label. H2/Postgres-safe.
     */
    private static final String PIPE_SVC =
            "CASE WHEN b.is_custom_service = true THEN COALESCE(b.custom_service_name, 'Servizio personalizzato') "
          + "ELSE COALESCE( "
          + "  (SELECT s.title FROM services s WHERE s.service_id = b.service_id), "
          + "  (SELECT MIN(s.title) FROM booking_services bs LEFT JOIN services s ON s.service_id = bs.service_id "
          + "     WHERE bs.booking_id = b.booking_id), "
          + "  'Appuntamento') END";

    // ---- Row carriers (clean Java types; JDBC quirks normalised in this layer) -----

    public record RevenueRow(LocalDateTime collectedAt, BigDecimal amount, boolean online,
                             String clientId, String clientName, String clientPhone) {}

    public record ProductLineRow(LocalDateTime collectedAt, BigDecimal amount, boolean online,
                                 String productName, long quantity,
                                 String clientId, String clientName, String clientPhone) {}

    public record NameAmountRow(String name, BigDecimal amount) {}

    public record ClientSeedRow(String clientId, String clientPhone, String clientName, LocalDateTime firstAt) {}

    /** One future, uncollected booking in the pipeline (valued at its expected amount). */
    public record PipelineRow(LocalDateTime startTime, BigDecimal amount,
                              String clientName, String serviceName) {}

    /** One unpaid line owed by a client (identity + amount + the booking's date). */
    public record ArretratoRow(String clientId, String clientName, String clientPhone,
                               BigDecimal amount, LocalDateTime occurredAt) {}

    /** Online-package rows already valued, plus the count that could not be valued. */
    public record OnlinePackages(List<RevenueRow> rows, long flaggedSkipped) {}

    // ===============================================================================
    // TREATMENTS leg (native — booking_services line valuation)
    // ===============================================================================

    /** Collected treatment bookings (positive), dated at collection, one row per booking. */
    public List<RevenueRow> treatmentRows(LocalDateTime from, LocalDateTime to) {
        String sql =
                "SELECT " + COLL + " AS collected_at, " + TREAT_AMT + " AS amount, "
              + "       b.payment_method, b.customer_id, b.customer_name, b.customer_phone "
              + "FROM bookings b "
              + "WHERE " + EXCL
              + " AND " + COLL + " >= :from AND " + COLL + " < :to "
              + " AND " + TREAT_AMT + " > 0";
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        return mapRevenueRows(rows);
    }

    /**
     * REFUNDED bookings, valued with the SAME treatment computation, dated at canceled_at.
     * The service treats these as a NEGATIVE contribution to the treatments leg so a past
     * month is not silently restated. Treated as FULL refunds only (partial refunds are
     * out of scope v1 — the app stores no partial-refund amount).
     */
    public List<RevenueRow> refundRows(LocalDateTime from, LocalDateTime to) {
        String sql =
                "SELECT b.canceled_at AS collected_at, " + TREAT_AMT + " AS amount, "
              + "       b.payment_method, b.customer_id, b.customer_name, b.customer_phone "
              + "FROM bookings b "
              + "WHERE b.booking_status = 'REFUNDED' AND b.canceled_at IS NOT NULL "
              + " AND b.canceled_at >= :from AND b.canceled_at < :to "
              + " AND " + EXCL
              + " AND " + TREAT_AMT + " > 0";
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        return mapRevenueRows(rows);
    }

    /** Per-service-line revenue (multi-service lines + legacy principal) for topServices. */
    public List<NameAmountRow> topServiceRows(LocalDateTime from, LocalDateTime to) {
        String sql =
                "SELECT title, amt FROM ( "
              + "  SELECT COALESCE(s.title, 'Servizio') AS title, "
              + "         COALESCE(bs.price_override, so.price, s.price) AS amt "
              + "  FROM booking_services bs "
              + "  JOIN bookings b ON b.booking_id = bs.booking_id "
              + "  LEFT JOIN services s ON s.service_id = bs.service_id "
              + "  LEFT JOIN service_options so ON so.option_id = bs.option_id "
              + "  WHERE (b.payment_method = 'PAID_ONLINE' OR bs.paid = true) AND " + EXCL
              + "    AND " + COLL + " >= :from AND " + COLL + " < :to "
              + "  UNION ALL "
              + "  SELECT COALESCE(s.title, 'Servizio') AS title, COALESCE(so.price, s.price) AS amt "
              + "  FROM bookings b "
              + "  LEFT JOIN services s ON s.service_id = b.service_id "
              + "  LEFT JOIN service_options so ON so.option_id = b.service_option_id "
              + "  WHERE b.service_id IS NOT NULL AND b.is_custom_service = false "
              + "    AND (b.payment_method = 'PAID_ONLINE' OR b.paid_in_store = true) "
              + "    AND NOT EXISTS (SELECT 1 FROM booking_services bs2 WHERE bs2.booking_id = b.booking_id) AND " + EXCL
              + "    AND " + COLL + " >= :from AND " + COLL + " < :to "
              + ") t WHERE amt IS NOT NULL AND amt > 0";
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        List<NameAmountRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) out.add(new NameAmountRow(str(r[0]), big(r[1])));
        return out;
    }

    // ===============================================================================
    // PRODUCTS leg (JPQL — BookingSale + Order/OrderItem are mapped)
    // ===============================================================================

    /**
     * In-store product sales (booking_sales, paid=true), dated at settled_at (fallback
     * added_at). O1: mixed-cart ONLINE products also land here (paid=true) — they are
     * channelled as online via the parent booking's payment_method, and never appear in
     * Order/order_items, so there is no double-count.
     */
    public List<ProductLineRow> inStoreProductRows(LocalDateTime from, LocalDateTime to) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                "SELECT b.settledAt, bs.addedAt, bs.unitPrice, bs.quantity, b.paymentMethod, "
              + "       c.id, b.customerName, b.customerPhone, bs.productName "
              + "FROM BookingSale bs, Booking b LEFT JOIN b.customer c "
              + "WHERE b.bookingId = bs.bookingId AND bs.paid = true "
              + "  AND COALESCE(b.settledAt, bs.addedAt) >= :from AND COALESCE(b.settledAt, bs.addedAt) < :to",
                Object[].class)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        List<ProductLineRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            LocalDateTime collectedAt = coalesce(ldt(r[0]), ldt(r[1]));
            long qty = lng(r[3]);
            BigDecimal amount = mul(big(r[2]), qty);
            out.add(new ProductLineRow(collectedAt, amount, isOnline(r[4]),
                    str(r[8]), qty, str(r[5]), str(r[6]), str(r[7])));
        }
        return out;
    }

    /**
     * Online product orders (Order/OrderItem). D6 fix: count any PAID-or-later status
     * ({@code PAID_PENDING_PICKUP, COMPLETED, SHIPPED}) by paidAt — not only the
     * pickup-pending state — so a picked-up order does not leak out of the report.
     */
    public List<ProductLineRow> onlineProductRows(LocalDateTime from, LocalDateTime to) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                "SELECT o.paidAt, oi.price, oi.quantity, p.name, o.customerName, o.customerPhone "
              + "FROM Order o JOIN o.orderItems oi JOIN oi.product p "
              + "WHERE o.orderStatus IN :statuses AND o.paidAt >= :from AND o.paidAt < :to",
                Object[].class)
                .setParameter("statuses", List.of(
                        OrderStatus.PAID_PENDING_PICKUP, OrderStatus.COMPLETED, OrderStatus.SHIPPED))
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        List<ProductLineRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            long qty = lng(r[2]);
            out.add(new ProductLineRow(ldt(r[0]), mul(big(r[1]), qty), true,
                    str(r[3]), qty, null, str(r[4]), str(r[5])));
        }
        return out;
    }

    // ===============================================================================
    // PACKAGES leg (JPQL)
    // ===============================================================================

    /**
     * Online packages recognised ONCE at purchase: amount = the package serviceOption's
     * full price (what Stripe charged), dated at purchasedAt, status NOT IN
     * {REFUNDED, CANCELLED}. A credit whose serviceOption (or its price) is null cannot
     * be valued → excluded and counted in flaggedSkipped so the data issue is visible.
     */
    public OnlinePackages onlinePackageRows(LocalDateTime from, LocalDateTime to) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                "SELECT pc.purchasedAt, so.price, c.id, pc.customerEmail "
              + "FROM PackageCredit pc LEFT JOIN pc.serviceOption so LEFT JOIN pc.customer c "
              + "WHERE pc.status NOT IN :excluded AND pc.purchasedAt >= :from AND pc.purchasedAt < :to",
                Object[].class)
                .setParameter("excluded", List.of(PackageCreditStatus.REFUNDED, PackageCreditStatus.CANCELLED))
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        List<RevenueRow> out = new ArrayList<>(rows.size());
        long flagged = 0;
        for (Object[] r : rows) {
            BigDecimal price = big(r[1]);
            if (price == null) { flagged++; continue; }
            out.add(new RevenueRow(ldt(r[0]), price, true, str(r[2]), str(r[3]), null));
        }
        return new OnlinePackages(out, flagged);
    }

    /** Admin packages: PAID installments by paidDate (the existing packages ledger). */
    public List<RevenueRow> adminInstallmentRows(LocalDate fromDate, LocalDate toExclusive) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                "SELECT pi.paidDate, pi.amount, a.clientName "
              + "FROM PackageInstallment pi JOIN pi.assignment a "
              + "WHERE pi.paid = true AND pi.paidDate >= :from AND pi.paidDate < :to",
                Object[].class)
                .setParameter("from", fromDate)
                .setParameter("to", toExclusive)
                .getResultList();
        List<RevenueRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            LocalDate d = (LocalDate) r[0];
            out.add(new RevenueRow(d != null ? d.atStartOfDay() : null, big(r[1]), false,
                    null, str(r[2]), null));
        }
        return out;
    }

    /**
     * D5 fix: admin UPFRONT packages with NO installment recorded would otherwise
     * contribute €0. Recognise {@code pricePaid} at createdAt for those (non-cancelled).
     */
    public List<RevenueRow> adminUpfrontFallbackRows(LocalDateTime from, LocalDateTime to) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                "SELECT a.createdAt, a.pricePaid, a.clientName "
              + "FROM ClientPackageAssignment a "
              + "WHERE a.paymentMode = :upfront AND a.status <> :cancelled AND a.pricePaid IS NOT NULL "
              + "  AND a.createdAt >= :from AND a.createdAt < :to "
              + "  AND NOT EXISTS (SELECT 1 FROM PackageInstallment pi WHERE pi.assignment = a)",
                Object[].class)
                .setParameter("upfront", ClientPackagePaymentMode.UPFRONT)
                .setParameter("cancelled", ClientPackageStatus.CANCELLED)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        List<RevenueRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new RevenueRow(ldt(r[0]), big(r[1]), false, null, str(r[2]), null));
        }
        return out;
    }

    // ===============================================================================
    // PROMOTIONS leg (JPQL — total_discounted_snapshot at the parent's collection date)
    // ===============================================================================

    public List<RevenueRow> promotionRows(LocalDateTime from, LocalDateTime to) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                "SELECT b.paidAt, b.settledAt, b.completedAt, b.paymentMethod, bpl.totalDiscountedSnapshot, "
              + "       c.id, b.customerName, b.customerPhone "
              + "FROM BookingPromotionLink bpl JOIN bpl.booking b LEFT JOIN b.customer c "
              + "WHERE bpl.paid = true "
              + "  AND (CASE WHEN b.paymentMethod = :pmOnline THEN b.paidAt ELSE COALESCE(b.settledAt, b.completedAt) END) >= :from "
              + "  AND (CASE WHEN b.paymentMethod = :pmOnline THEN b.paidAt ELSE COALESCE(b.settledAt, b.completedAt) END) <  :to",
                Object[].class)
                .setParameter("pmOnline", PaymentMethod.PAID_ONLINE)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        List<RevenueRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            boolean online = isOnline(r[3]);
            LocalDateTime collectedAt = online ? ldt(r[0]) : coalesce(ldt(r[1]), ldt(r[2]));
            out.add(new RevenueRow(collectedAt, big(r[4]), online, str(r[5]), str(r[6]), str(r[7])));
        }
        return out;
    }

    // ===============================================================================
    // PREVISTO (pipeline + arretrati) and scalar counts
    // ===============================================================================

    /**
     * Future CONFIRMED, uncollected, non-prepaid bookings, one raw row each (start time,
     * expected amount, client, display service name). The service buckets these by week,
     * picks the soonest few and totals them — same raw-rows-in-Java approach as the
     * incassato legs.
     */
    public List<PipelineRow> pipelineRows(LocalDateTime now) {
        String sql =
                "SELECT b.start_time, " + PIPE_AMT + " AS amt, b.customer_name, " + PIPE_SVC + " AS svc "
              + "FROM bookings b "
              + "WHERE b.booking_status = 'CONFIRMED' AND b.start_time >= :now AND b.paid_at IS NULL "
              + "  AND " + EXCL
              + "  AND " + PIPE_AMT + " > 0";
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql).setParameter("now", now).getResultList();
        List<PipelineRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new PipelineRow(ldt(r[0]), big(r[1]), str(r[2]), str(r[3])));
        }
        return out;
    }

    /**
     * Outstanding owed (arretrati) across ALL clients as raw rows — the same 7-branch
     * unpaid union as {@code BookingRepository.findArretratiForCustomer} (per-customer
     * phone predicates and the ::text/::uuid label casts dropped, so it runs on H2 too),
     * but each branch also carries the booking's client identity and start time. The
     * service sums every row to {@code arretratiTotal} and groups them per debtor (oldest
     * start time = "since"); rows with a non-positive price are dropped.
     */
    public List<ArretratoRow> arretratiRows() {
        String sql =
                "SELECT price, customer_id, customer_name, customer_phone, occurred_at FROM ( "
              + "  SELECT COALESCE(bs.price_override, so.price, s.price) AS price, "
              + "         b.customer_id, b.customer_name, b.customer_phone, b.start_time AS occurred_at "
              + "  FROM booking_services bs JOIN bookings b ON b.booking_id = bs.booking_id "
              + "  LEFT JOIN services s ON s.service_id = bs.service_id "
              + "  LEFT JOIN service_options so ON so.option_id = bs.option_id "
              + "  WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.custom_total_price IS NULL AND bs.paid = false "
              + "  UNION ALL "
              + "  SELECT b.custom_service_price AS price, "
              + "         b.customer_id, b.customer_name, b.customer_phone, b.start_time AS occurred_at "
              + "  FROM bookings b "
              + "  WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL AND b.custom_total_price IS NULL "
              + "    AND b.is_custom_service = true AND b.custom_service_paid = false "
              + "  UNION ALL "
              + "  SELECT CASE WHEN cpa.total_sessions > 0 THEN cpa.price_paid / cpa.total_sessions ELSE cpa.price_paid END AS price, "
              + "         b.customer_id, b.customer_name, b.customer_phone, b.start_time AS occurred_at "
              + "  FROM booking_package_link bpl JOIN bookings b ON b.booking_id = bpl.booking_id "
              + "  JOIN client_package_assignments cpa ON cpa.id = bpl.client_package_assignment_id "
              + "  WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL AND b.custom_total_price IS NULL "
              + "    AND bpl.paid = false AND cpa.paid_upfront = false "
              + "  UNION ALL "
              + "  SELECT COALESCE(so.price, s.price) AS price, "
              + "         b.customer_id, b.customer_name, b.customer_phone, b.start_time AS occurred_at "
              + "  FROM bookings b "
              + "  LEFT JOIN services s ON s.service_id = b.service_id "
              + "  LEFT JOIN service_options so ON so.option_id = b.service_option_id "
              + "  WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL AND b.custom_total_price IS NULL "
              + "    AND b.service_id IS NOT NULL AND b.is_custom_service = false AND b.paid_in_store = false "
              + "    AND NOT EXISTS (SELECT 1 FROM booking_services bs2 WHERE bs2.booking_id = b.booking_id) "
              + "  UNION ALL "
              + "  SELECT b.custom_total_price AS price, "
              + "         b.customer_id, b.customer_name, b.customer_phone, b.start_time AS occurred_at "
              + "  FROM bookings b "
              + "  WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL AND b.custom_total_price IS NOT NULL "
              + "    AND ( EXISTS (SELECT 1 FROM booking_services bs WHERE bs.booking_id = b.booking_id AND bs.paid = false) "
              + "       OR EXISTS (SELECT 1 FROM booking_package_link bpl JOIN client_package_assignments cpa ON cpa.id = bpl.client_package_assignment_id "
              + "                   WHERE bpl.booking_id = b.booking_id AND bpl.paid = false AND cpa.paid_upfront = false) "
              + "       OR (b.is_custom_service = true AND b.custom_service_paid = false) "
              + "       OR (b.service_id IS NOT NULL AND b.is_custom_service = false AND b.paid_in_store = false "
              + "             AND NOT EXISTS (SELECT 1 FROM booking_services bs2 WHERE bs2.booking_id = b.booking_id)) ) "
              + "  UNION ALL "
              + "  SELECT sl.unit_price * sl.quantity AS price, "
              + "         b.customer_id, b.customer_name, b.customer_phone, b.start_time AS occurred_at "
              + "  FROM booking_sales sl JOIN bookings b ON b.booking_id = sl.booking_id "
              + "  WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL "
              + "    AND sl.promotion_link_id IS NULL AND sl.paid = false "
              + "  UNION ALL "
              + "  SELECT bpl.total_discounted_snapshot AS price, "
              + "         b.customer_id, b.customer_name, b.customer_phone, b.start_time AS occurred_at "
              + "  FROM booking_promotion_link bpl JOIN bookings b ON b.booking_id = bpl.booking_id "
              + "  WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL "
              + "    AND bpl.paid = false AND bpl.promotion_id IS NOT NULL "
              + ") t WHERE price IS NOT NULL AND price > 0";
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(sql).getResultList();
        List<ArretratoRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new ArretratoRow(str(r[1]), str(r[2]), str(r[3]), big(r[0]), ldt(r[4])));
        }
        return out;
    }

    /** (clientId, phone, name, startTime) for every non-pending booking — newClients seed. */
    public List<ClientSeedRow> clientSeedRows() {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                "SELECT c.id, b.customerPhone, b.customerName, b.startTime "
              + "FROM Booking b LEFT JOIN b.customer c "
              + "WHERE b.bookingStatus <> :pending",
                Object[].class)
                .setParameter("pending", BookingStatus.PENDING_PAYMENT)
                .getResultList();
        List<ClientSeedRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) out.add(new ClientSeedRow(str(r[0]), str(r[1]), str(r[2]), ldt(r[3])));
        return out;
    }

    public long cancelledCount(LocalDateTime from, LocalDateTime to) {
        return (Long) em.createQuery(
                "SELECT COUNT(b) FROM Booking b "
              + "WHERE b.bookingStatus IN :statuses AND b.startTime >= :from AND b.startTime < :to")
                .setParameter("statuses", List.of(BookingStatus.CANCELLED, BookingStatus.NO_SHOW))
                .setParameter("from", from)
                .setParameter("to", to)
                .getSingleResult();
    }

    // ---- Mapping helpers (normalise JDBC/JPQL return types) ------------------------

    private List<RevenueRow> mapRevenueRows(List<Object[]> rows) {
        List<RevenueRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new RevenueRow(ldt(r[0]), big(r[1]), isOnline(r[2]), str(r[3]), str(r[4]), str(r[5])));
        }
        return out;
    }

    private static boolean isOnline(Object pm) {
        if (pm instanceof PaymentMethod x) return x == PaymentMethod.PAID_ONLINE;
        return "PAID_ONLINE".equals(String.valueOf(pm));
    }

    private static LocalDateTime ldt(Object o) {
        if (o == null) return null;
        if (o instanceof LocalDateTime x) return x;
        if (o instanceof java.sql.Timestamp x) return x.toLocalDateTime();
        if (o instanceof java.time.Instant x) return LocalDateTime.ofInstant(x, ZoneId.systemDefault());
        if (o instanceof java.util.Date x) return new java.sql.Timestamp(x.getTime()).toLocalDateTime();
        throw new IllegalStateException("Unexpected timestamp type: " + o.getClass());
    }

    private static BigDecimal big(Object o) {
        if (o == null) return null;
        if (o instanceof BigDecimal x) return x;
        if (o instanceof Number x) return new BigDecimal(x.toString());
        throw new IllegalStateException("Unexpected numeric type: " + o.getClass());
    }

    private static long lng(Object o) {
        return o == null ? 0L : ((Number) o).longValue();
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static BigDecimal mul(BigDecimal price, long qty) {
        return price == null ? null : price.multiply(BigDecimal.valueOf(qty));
    }

    private static <T> T coalesce(T a, T b) {
        return a != null ? a : b;
    }
}
