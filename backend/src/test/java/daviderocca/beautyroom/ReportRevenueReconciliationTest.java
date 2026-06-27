package daviderocca.beautyroom;

import daviderocca.beautyroom.DTO.orderDTOs.NewOrderDTO;
import daviderocca.beautyroom.DTO.orderDTOs.OrderResponseDTO;
import daviderocca.beautyroom.DTO.orderItemDTOs.NewOrderItemDTO;
import daviderocca.beautyroom.DTO.reportDTOs.IncassatoDTO;
import daviderocca.beautyroom.DTO.reportDTOs.PrevistoDTO;
import daviderocca.beautyroom.DTO.reportDTOs.ReportResponseDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.BookingSale;
import daviderocca.beautyroom.entities.Category;
import daviderocca.beautyroom.entities.Order;
import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.OrderStatus;
import daviderocca.beautyroom.enums.PackageCreditStatus;
import daviderocca.beautyroom.enums.PaymentMethod;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.BookingSaleRepository;
import daviderocca.beautyroom.repositories.CategoryRepository;
import daviderocca.beautyroom.repositories.OrderRepository;
import daviderocca.beautyroom.repositories.PackageCreditRepository;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.repositories.ServiceItemRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import daviderocca.beautyroom.services.OrderService;
import daviderocca.beautyroom.services.ReportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * DB-backed cash-basis reconciliation safety net for the revenue report (the human will
 * not review the report SQL by hand). Persists real entity graphs into the H2 test DB
 * and runs the actual {@link ReportService} / native {@code ReportRepository} SQL,
 * asserting the partition is correct and mutually exclusive.
 *
 * <p>H2 (ddl-auto, Flyway off) generates {@code booking_services} from the {@code
 * @ManyToMany} as just (booking_id, service_id); the report's per-line valuation needs
 * the {@code price_override / option_id / paid} columns that live only in the Flyway
 * schema. We ADD them to the test schema so the real native SQL executes here.
 */
@SpringBootTest
@ActiveProfiles("test")
class ReportRevenueReconciliationTest {

    @Autowired private ReportService reportService;
    @Autowired private OrderService orderService;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ServiceItemRepository serviceItemRepository;
    @Autowired private ServiceOptionRepository serviceOptionRepository;
    @Autowired private PackageCreditRepository packageCreditRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private BookingSaleRepository bookingSaleRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private OrderRepository orderRepository;

    // All scenario money is collected "yesterday"; the report range straddles today so
    // the PackageCredit's @PrePersist purchasedAt (= now, not settable — updatable=false)
    // also falls inside it. Relative dates keep the test correct on any run date.
    private final LocalDateTime base = LocalDateTime.now().minusDays(2);
    private final LocalDate from = LocalDate.now().minusMonths(1);
    private final LocalDate to = LocalDate.now().plusMonths(1);

    @BeforeEach
    void resetSchemaAndData() {
        // The report's per-line valuation reads booking_services columns that live only in
        // the Flyway schema; add them so the real native SQL runs on H2 (idempotent).
        jdbc.execute("ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS price_override DECIMAL(10,2)");
        jdbc.execute("ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS option_id UUID");
        jdbc.execute("ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE");

        // @SpringBootTest caches/shares the H2 context, and these tests commit (no rollback),
        // so wipe to a clean slate per method to keep the money assertions deterministic.
        jdbc.execute("SET REFERENTIAL_INTEGRITY FALSE");
        for (String t : List.of(
                "booking_services", "booking_sales", "booking_promotion_link", "booking_package_link",
                "package_installments", "package_credits", "order_items", "orders",
                "client_package_assignments", "bookings", "service_options", "services",
                "products", "categories")) {
            try { jdbc.execute("DELETE FROM " + t); } catch (Exception ignore) { /* table may not exist */ }
        }
        jdbc.execute("SET REFERENTIAL_INTEGRITY TRUE");
    }

    @Test
    @DisplayName("cash-basis report reconciles: one euro per leg, no double-count, refunds net out")
    void reportReconciles() {
        Category cat = categoryRepository.save(new Category("recon", "Recon"));
        ServiceItem svc70 = saveService(cat, "Trattamento 70", new BigDecimal("70.00"));   // B catalog price
        ServiceItem svc50 = saveService(cat, "Trattamento 50", new BigDecimal("50.00"));   // D principal price
        ServiceItem svcPkg = saveService(cat, "Servizio pacchetto", new BigDecimal("300.00"));
        ServiceOption pkgOption = savePackageOption(svcPkg, new BigDecimal("300.00"), 6);
        Product product25 = productRepository.save(new Product(
                "Crema 25", new BigDecimal("25.00"), "s", "d", List.of("img"), 100, cat));

        // --- A) Online 6-session package: recognised ONCE (300) at purchase; its session
        //        bookings must add 0 to trattamenti (would be 600 if the exclusion failed).
        PackageCredit pc = new PackageCredit();
        pc.setCustomerEmail("pkg@client.it");
        pc.setSessionsTotal(6);
        pc.setSessionsRemaining(4);
        pc.setStatus(PackageCreditStatus.ACTIVE);
        pc.setService(svcPkg);
        pc.setServiceOption(pkgOption);
        pc = packageCreditRepository.save(pc); // @PrePersist stamps purchasedAt = now (in range)

        for (int i = 0; i < 2; i++) {
            Booking session = newBooking("Pkg Client", "pkg@client.it", "+39333000000" + i, svcPkg, pkgOption);
            session.setPackageCredit(pc);
            session.setPaymentMethod(PaymentMethod.PAID_ONLINE);
            session.setPaidAt(base);
            session.setBookingStatus(BookingStatus.COMPLETED);
            bookingRepository.save(session);
        }

        // --- B) In-store bundle: custom_total_price 45 must win over the 70 catalog price.
        Booking bundle = newBooking("Bundle Client", "bundle@client.it", "+393331111111", svc70, null);
        bundle.setCustomTotalPrice(new BigDecimal("45.00"));
        bundle.setPaymentMethod(PaymentMethod.PAY_IN_STORE);
        bundle.setPaidInStore(true);
        bundle.setSettledAt(base);
        bundle.setBookingStatus(BookingStatus.COMPLETED);
        bookingRepository.save(bundle);

        // --- C) In-store product sale (paid) on a product-only booking → prodotti 40.
        Booking productBooking = newBooking("Shop Client", "shop@client.it", "+393332222222", null, null);
        productBooking.setPaymentMethod(PaymentMethod.PAY_IN_STORE);
        productBooking.setSettledAt(base);
        productBooking.setBookingStatus(BookingStatus.COMPLETED);
        productBooking = bookingRepository.save(productBooking);
        BookingSale sale = new BookingSale();
        sale.setBookingId(productBooking.getBookingId());
        sale.setProductId(product25.getProductId());
        sale.setProductName("Crema 25");
        sale.setQuantity(2);
        sale.setUnitPrice(new BigDecimal("20.00"));
        sale.setPaid(true);
        bookingSaleRepository.save(sale);

        // --- D) REFUNDED booking: +50 at settle, -50 at refund → net 0, refundsTotal 50.
        Booking refunded = newBooking("Refund Client", "refund@client.it", "+393333333333", svc50, null);
        refunded.setPaymentMethod(PaymentMethod.PAY_IN_STORE);
        refunded.setPaidInStore(true);
        refunded.setSettledAt(base);
        refunded.setBookingStatus(BookingStatus.REFUNDED);
        refunded.setCanceledAt(base);
        bookingRepository.save(refunded);

        // --- E) Online order that has been PICKED UP (COMPLETED) must still count (D6) → 25.
        OrderResponseDTO orderResp = orderService.saveOrder(new NewOrderDTO(
                "Web", "Client", "web@client.it", "+393334444444", "ritiro",
                List.of(new NewOrderItemDTO(1, product25.getProductId()))), null);
        Order order = orderRepository.findById(orderResp.orderId()).orElseThrow();
        order.setOrderStatus(OrderStatus.COMPLETED);
        order.setPaidAt(base);
        orderRepository.save(order);

        // ---------------------------------------------------------------------------
        ReportResponseDTO report = reportService.getReport(from, to, "none");
        IncassatoDTO inc = report.incassato();

        // Per-leg correctness ------------------------------------------------------
        assertThat(inc.byType().pacchetti()).as("online package counted ONCE, not N x")
                .isEqualByComparingTo("300.00");
        assertThat(inc.byType().trattamenti()).as("custom 45 wins over catalog 70; refund nets to 0; sessions add 0")
                .isEqualByComparingTo("45.00");
        assertThat(inc.byType().prodotti()).as("in-store 40 + online (picked-up) 25")
                .isEqualByComparingTo("65.00");
        assertThat(inc.byType().promozioni()).isEqualByComparingTo("0.00");
        assertThat(inc.refundsTotal()).isEqualByComparingTo("50.00");
        assertThat(inc.total()).isEqualByComparingTo("410.00");
        assertThat(inc.appointmentsCount()).as("only the 2 collected treatment bookings (B, D)").isEqualTo(2L);

        // Mutual exclusivity: every euro in exactly one leg ------------------------
        BigDecimal legsSum = inc.byType().trattamenti()
                .add(inc.byType().prodotti())
                .add(inc.byType().pacchetti())
                .add(inc.byType().promozioni());
        assertThat(legsSum).as("sum of legs == total (no euro double-counted)")
                .isEqualByComparingTo(inc.total());

        // Channel split also reconciles to the total ------------------------------
        assertThat(inc.byChannel().online()).isEqualByComparingTo("325.00");   // 300 pkg + 25 order
        assertThat(inc.byChannel().inStore()).isEqualByComparingTo("85.00");   // 45 bundle + 40 sale + 0 refund-net
        assertThat(inc.byChannel().online().add(inc.byChannel().inStore()))
                .isEqualByComparingTo(inc.total());

        // Scalars ------------------------------------------------------------------
        assertThat(report.cancelledCount()).isEqualTo(0L);
        assertThat(report.flaggedSkipped()).isEqualTo(0L);
        assertThat(report.previsto().arretratiTotal()).isEqualByComparingTo("0.00");
        assertThat(report.previsto().pipelineTotal()).isEqualByComparingTo("0.00");
        assertThat(report.previsto().upcomingCount()).isEqualTo(0L);

        // Contract shape present ---------------------------------------------------
        assertThat(report.range().compareMode()).isEqualTo("none");
        assertThat(inc.monthly()).isNotEmpty();
        assertThat(report.topProducts()).anyMatch(p -> p.name().equals("Crema 25"));
    }

    @Test
    @DisplayName("compare=prevPeriod runs the model twice and returns a delta (empty prior window)")
    void comparisonRunsModelTwice() {
        Category cat = categoryRepository.save(new Category("cmp", "Cmp"));
        ServiceItem svc = saveService(cat, "Trattamento", new BigDecimal("60.00"));
        Booking b = newBooking("Cmp Client", "cmp@client.it", "+393335555555", svc, null);
        b.setPaymentMethod(PaymentMethod.PAY_IN_STORE);
        b.setPaidInStore(true);
        b.setSettledAt(base);
        b.setBookingStatus(BookingStatus.COMPLETED);
        bookingRepository.save(b);

        ReportResponseDTO report = reportService.getReport(from, to, "prevPeriod");

        assertThat(report.range().compareMode()).isEqualTo("prevPeriod");
        assertThat(report.range().compareFrom()).isNotNull();
        assertThat(report.incassato().byType().trattamenti()).isEqualByComparingTo("60.00");
        // Prior equal-length window holds no data → delta equals the whole current total.
        assertThat(report.comparison().incassatoTotalDelta()).isEqualByComparingTo(report.incassato().total());
    }

    @Test
    @DisplayName("previsto detail: byType/timeline/upcoming and per-debtor arretrati reconcile")
    void previstoReconciles() {
        Category cat = categoryRepository.save(new Category("prev", "Prev"));
        ServiceItem svcFuture = saveService(cat, "Trattamento futuro", new BigDecimal("60.00"));
        ServiceItem svcDebt = saveService(cat, "Trattamento dovuto", new BigDecimal("80.00"));

        // --- Pipeline: a future CONFIRMED, unpaid, non-package/promo booking → 60.
        LocalDateTime future = LocalDateTime.now().plusDays(10);
        Booking up = new Booking("Futura Cliente", "future@client.it", "+393336000001",
                future, future.plusHours(1), null, svcFuture, null, null);
        up.setPaymentMethod(PaymentMethod.PAY_IN_STORE);
        up.setBookingStatus(BookingStatus.CONFIRMED);
        bookingRepository.save(up);

        // --- Arretrato: a COMPLETED, unpaid legacy-principal booking → owes 80.
        Booking debt = newBooking("Debitrice Cliente", "debt@client.it", "+393336000002", svcDebt, null);
        debt.setPaymentMethod(PaymentMethod.PAY_IN_STORE);
        debt.setPaidInStore(false);
        debt.setBookingStatus(BookingStatus.COMPLETED);
        bookingRepository.save(debt);

        ReportResponseDTO report = reportService.getReport(from, to, "none");
        PrevistoDTO previsto = report.previsto();

        // Pipeline + byType: the pipeline surface is the treatments leg, so it all lands
        // in trattamenti and the four buckets still sum to pipelineTotal.
        assertThat(previsto.pipelineTotal()).isEqualByComparingTo("60.00");
        assertThat(previsto.upcomingCount()).isEqualTo(1L);
        BigDecimal byTypeSum = previsto.byType().trattamenti()
                .add(previsto.byType().prodotti())
                .add(previsto.byType().pacchetti())
                .add(previsto.byType().promozioni());
        assertThat(byTypeSum).as("sum(byType) == pipelineTotal")
                .isEqualByComparingTo(previsto.pipelineTotal());
        assertThat(previsto.byType().trattamenti()).isEqualByComparingTo("60.00");

        // Timeline: 8 weeks, the future booking (+10d) is within them → whole pipeline.
        assertThat(previsto.timeline()).hasSize(8);
        BigDecimal tlSum = previsto.timeline().stream()
                .map(w -> w.amount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(tlSum).isEqualByComparingTo("60.00");

        // Upcoming: the single future appointment, named by its principal service.
        assertThat(previsto.upcoming()).hasSize(1);
        assertThat(previsto.upcoming().get(0).serviceName()).isEqualTo("Trattamento futuro");
        assertThat(previsto.upcoming().get(0).amount()).isEqualByComparingTo("60.00");

        // Arretrati: the per-debtor list sums to arretratiTotal (across all debtors).
        assertThat(previsto.arretratiTotal()).isEqualByComparingTo("80.00");
        BigDecimal debtorsSum = previsto.arretrati().stream()
                .map(a -> a.amount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(debtorsSum).as("sum(all debtors) == arretratiTotal")
                .isEqualByComparingTo(previsto.arretratiTotal());
        assertThat(previsto.arretrati()).hasSize(1);
        assertThat(previsto.arretrati().get(0).clientName()).isEqualTo("Debitrice Cliente");
        assertThat(previsto.arretrati().get(0).phone()).isEqualTo("+393336000002");
        assertThat(previsto.arretrati().get(0).since()).isNotNull();
    }

    // ---- fixtures ----------------------------------------------------------------

    private ServiceItem saveService(Category cat, String title, BigDecimal price) {
        return serviceItemRepository.save(new ServiceItem(title, 30, price, "short", "desc", List.of(), cat));
    }

    private ServiceOption savePackageOption(ServiceItem svc, BigDecimal price, int sessions) {
        ServiceOption opt = new ServiceOption();
        opt.setService(svc);
        opt.setName("Pacchetto " + sessions);
        opt.setPrice(price);
        opt.setSessions(sessions);
        opt.setPackage(true);
        return serviceOptionRepository.save(opt);
    }

    private Booking newBooking(String name, String email, String phone, ServiceItem service, ServiceOption option) {
        return new Booking(name, email, phone, base, base.plusHours(1), null, service, option, null);
    }
}
