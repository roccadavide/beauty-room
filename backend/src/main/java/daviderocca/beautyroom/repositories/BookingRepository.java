package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.enums.BookingStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    List<Booking> findByCustomerEmailIgnoreCase(String customerEmail);

    @Query("""
        select b
        from Booking b
        where b.user.userId = :userId
        order by b.startTime desc
    """)
    List<Booking> findByUserIdOrderByStartTimeDesc(@Param("userId") UUID userId);

    @Query("""
        select b
        from Booking b
        where b.user.userId = :userId
           or b.linkedUser.userId = :linkedUserId
        order by b.startTime desc
    """)
    List<Booking> findByUserIdOrLinkedUserUserIdOrderByStartTimeDesc(
            @Param("userId") UUID userId,
            @Param("linkedUserId") UUID linkedUserId);

    // ===== Overlap LOCK (create) =====
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT b
        FROM Booking b
        WHERE b.bookingStatus IN :blockingStatuses
          AND b.startTime < :endTime
          AND b.endTime   > :startTime
    """)
    List<Booking> lockOverlappingBookingsByStatuses(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("blockingStatuses") List<BookingStatus> blockingStatuses
    );

    // ===== Overlap LOCK (update) =====
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT b
        FROM Booking b
        WHERE b.bookingId <> :bookingId
          AND b.bookingStatus IN :blockingStatuses
          AND b.startTime < :endTime
          AND b.endTime   > :startTime
    """)
    List<Booking> lockOverlappingBookingsByStatusesExcluding(
            @Param("bookingId") UUID bookingId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("blockingStatuses") List<BookingStatus> blockingStatuses
    );

    // ===== Availability (range) =====
    @Query("""
        SELECT b
        FROM Booking b
        WHERE b.bookingStatus IN :blockingStatuses
          AND b.startTime < :to
          AND b.endTime   > :from
        ORDER BY b.startTime ASC
    """)
    List<Booking> findBookingsByStatusesIntersectingRange(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            @Param("blockingStatuses") List<BookingStatus> blockingStatuses
    );

    // ===== Admin agenda (fetch join) - include ALL statuses =====
    @Query("""
    SELECT b
    FROM Booking b
    LEFT JOIN FETCH b.service s
    LEFT JOIN FETCH b.serviceOption so
    LEFT JOIN FETCH b.packageCredit pc
    WHERE b.startTime < :to
      AND b.endTime   > :from
    ORDER BY b.startTime ASC
""")
    List<Booking> findAgendaRangeWithDetails(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @Query("""
        SELECT b FROM Booking b
        WHERE DATE(b.startTime) = :day
          AND b.bookingStatus <> daviderocca.beautyroom.enums.BookingStatus.CANCELLED
        ORDER BY b.startTime
    """)
    List<Booking> findByDateAndStatusNotCancelled(@Param("day") LocalDate day);

    // ===== Stripe =====
    Optional<Booking> findByStripeSessionId(String stripeSessionId);

    // ===== Expire HOLD =====
    List<Booking> findByBookingStatusAndExpiresAtBefore(BookingStatus status, LocalDateTime time);

    @EntityGraph(attributePaths = {"service", "serviceOption", "user"})
    @Query("select b from Booking b where b.bookingId = :id")
    Optional<Booking> findByIdWithDetails(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"service", "serviceOption", "user"})
    @Query("select b from Booking b")
    Page<Booking> findAllWithDetails(Pageable pageable);

    /**
     * Returns the 5 most recent bookings for a given customer email.
     * Used by CustomerService.getSummary to populate the history panel.
     */
    List<Booking> findTop5ByCustomerEmailOrderByStartTimeDesc(String customerEmail);

    List<Booking> findByCustomerEmailOrderByStartTimeDesc(String customerEmail);

    /**
     * History matched by NORMALIZED phone (digits-only), the stable identifier for the
     * walk-in-heavy salon. Mirrors the arretrati keying so a walk-in with arretrati
     * never shows an empty history. Empty-guard (<> '') excludes phone-less rows.
     * PERF: per-row normalization blocks index use — fine at current volumes.
     */
    @Query(value = """
        SELECT * FROM bookings b
        WHERE regexp_replace(b.customer_phone, '[^0-9]', '', 'g') <> ''
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') = regexp_replace(:phone, '[^0-9]', '', 'g')
        ORDER BY b.start_time DESC
        """, nativeQuery = true)
    List<Booking> findByCustomerPhoneNormalizedOrderByStartTimeDesc(@Param("phone") String phone);

    // ===== Lock singolo booking per update di stato =====
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.bookingId = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") UUID id);

    /**
     * Prenotazioni PMU future con consenso non ancora firmato (per scheduler e pannello admin).
     */
    @Query("""
        SELECT b FROM Booking b
        JOIN FETCH b.service s
        WHERE s.consentRequired = true
          AND b.consentSigned = false
          AND b.bookingStatus IN :statuses
          AND b.startTime BETWEEN :from AND :to
        ORDER BY b.startTime ASC
    """)
    List<Booking> findPmuUnsignedFuture(
            @Param("statuses") List<BookingStatus> statuses,
            @Param("from")     LocalDateTime from,
            @Param("to")       LocalDateTime to
    );

    /**
     * Prenotazioni COMPLETED con completedAt tra from e to
     * a cui non è ancora stata inviata la richiesta recensione.
     */
    @Query("""
        SELECT b FROM Booking b
        LEFT JOIN FETCH b.service
        WHERE b.bookingStatus = daviderocca.beautyroom.enums.BookingStatus.COMPLETED
        AND b.completedAt IS NOT NULL
        AND b.completedAt BETWEEN :from AND :to
        AND b.reviewRequestSentAt IS NULL
        """)
    List<Booking> findCompletedBetweenWithoutReviewRequest(
            @Param("from") LocalDateTime from,
            @Param("to")   LocalDateTime to
    );

    // ===== V64: derived "arretrati" (no dedicated table) =====
    // A customer has arretrati when a COMPLETED booking still has any unpaid
    // line. paidOnline (paid_at set) and PackageCredit-backed bookings are
    // excluded — they are always considered settled (mirrors isLineSettled on
    // the frontend). Backed by the partial indexes idx_bs_unpaid_completed /
    // idx_bpl_unpaid (V64).
    //
    // Bug3: the single-service "principal" (only on bookings.service_id, NO
    // booking_services row — customer/manual single-service paths) is also covered,
    // via bookings.paid_in_store (settled by the completion drawer). See the
    // "legacy principal" branch below.
    //
    // KNOWN LIMIT (out of scope): package_credit_id IS NULL excludes a credit-backed
    // booking ENTIRELY. Unpaid EXTRA lines on a fully credit-backed booking are not
    // surfaced as arretrati — the covered session is not row-identifiable, and the
    // whole-booking exclusion stays consistent with frontend isLineSettled.
    //
    // KEYED BY PHONE (not email): the salon is walk-in-heavy — most bookings carry a
    // generated walkin+…@beautyroom.local email but a REAL phone, so email never
    // matches a returning walk-in. Both sides are normalized to digits-only
    // (regexp_replace [^0-9]) so "+39 333…" / "333 333…" collapse to the same key.
    // The empty-guard (<> '') prevents phone-less rows from all matching each other.
    // PERF: normalizing customer_phone per row blocks index use on the comparison —
    // fine at current volumes (hundreds of bookings). If volumes grow, add a computed
    // phone_normalized column + index (out of scope today).

    /**
     * True if the customer (matched by normalized phone) has any unsettled line on a past
     * COMPLETED booking.
     *
     * ⚠ DUPLICATED PREDICATE — the four OR branches below define "what counts as an
     * arretrato". They are copied VERBATIM into {@link #findPhonesWithOutstanding(Collection)},
     * the batch variant the agenda uses. There is no shared SQL fragment (a DB view would be
     * a schema refactor, out of scope). If you change the definition of an unsettled line,
     * edit it in BOTH methods — otherwise this per-customer check and the agenda badge
     * DIVERGE SILENTLY: a line counts as arretrato in one place but not the other.
     */
    @Query(value = """
        SELECT EXISTS (
            SELECT 1
            FROM bookings b
            WHERE b.booking_status = 'COMPLETED'
              AND b.paid_at IS NULL
              AND b.package_credit_id IS NULL
              AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') <> ''
              AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') = regexp_replace(:phone, '[^0-9]', '', 'g')
              AND (
                    EXISTS (SELECT 1 FROM booking_services bs
                             WHERE bs.booking_id = b.booking_id AND bs.paid = false)
                 OR EXISTS (SELECT 1 FROM booking_package_link bpl
                              JOIN client_package_assignments cpa ON cpa.id = bpl.client_package_assignment_id
                             WHERE bpl.booking_id = b.booking_id AND bpl.paid = false
                               AND cpa.paid_upfront = false)
                 OR (b.is_custom_service = true AND b.custom_service_paid = false)
                 OR (b.service_id IS NOT NULL AND b.is_custom_service = false AND b.paid_in_store = false
                       AND NOT EXISTS (SELECT 1 FROM booking_services bs2 WHERE bs2.booking_id = b.booking_id))
                 OR EXISTS (SELECT 1 FROM booking_sales sl
                             WHERE sl.booking_id = b.booking_id
                               AND sl.promotion_link_id IS NULL AND sl.paid = false)
              )
        )
        """, nativeQuery = true)
    boolean existsUnsettledCompletedLinesForCustomer(@Param("phone") String phone);

    /**
     * Batch variant for the admin agenda. Given the already-normalized (digits-only) phones
     * of the bookings currently in view, returns the SUBSET that has ≥1 unsettled line on a
     * past COMPLETED booking. ONE query for the whole agenda range — NEVER call this per-card
     * (that re-introduces an N+1). Each card then sets hasOutstanding =
     * result.contains(digitsOnly(phone)). The returned phones are already normalized, matching
     * the caller's digitsOnly() keys. Callers MUST pass a non-empty collection (guarded
     * upstream) so IN (:phones) never degenerates to IN ().
     *
     * ⚠ DUPLICATED PREDICATE — the four OR branches are copied VERBATIM from
     * {@link #existsUnsettledCompletedLinesForCustomer(String)}; only the phone match
     * (= → IN) and the projection (EXISTS → SELECT DISTINCT) differ. If you change what
     * counts as an unsettled line, edit it in BOTH methods or they diverge silently.
     */
    @Query(value = """
        SELECT DISTINCT regexp_replace(b.customer_phone, '[^0-9]', '', 'g')
        FROM bookings b
        WHERE b.booking_status = 'COMPLETED'
          AND b.paid_at IS NULL
          AND b.package_credit_id IS NULL
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') <> ''
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') IN (:phones)
          AND (
                EXISTS (SELECT 1 FROM booking_services bs
                         WHERE bs.booking_id = b.booking_id AND bs.paid = false)
             OR EXISTS (SELECT 1 FROM booking_package_link bpl
                          JOIN client_package_assignments cpa ON cpa.id = bpl.client_package_assignment_id
                         WHERE bpl.booking_id = b.booking_id AND bpl.paid = false
                           AND cpa.paid_upfront = false)
             OR (b.is_custom_service = true AND b.custom_service_paid = false)
             OR (b.service_id IS NOT NULL AND b.is_custom_service = false AND b.paid_in_store = false
                   AND NOT EXISTS (SELECT 1 FROM booking_services bs2 WHERE bs2.booking_id = b.booking_id))
             OR EXISTS (SELECT 1 FROM booking_sales sl
                         WHERE sl.booking_id = b.booking_id
                           AND sl.promotion_link_id IS NULL AND sl.paid = false)
          )
        """, nativeQuery = true)
    List<String> findPhonesWithOutstanding(@Param("phones") Collection<String> phones);

    /**
     * Itemised unsettled lines for a customer's COMPLETED bookings.
     * Columns: [booking_id (uuid), occurred_at (timestamp), label (text), price (numeric),
     *           kind (text), ref_id (uuid)].
     * kind ∈ service|custom|package|legacy|bundle; ref_id is the settle key for that kind
     * (service/legacy → catalog service_id; package → ClientPackageAssignment id; custom/
     * bundle → NULL). Drives the per-row "Salda" payload (mirrors CompletionDrawer refKind).
     * Every UNION branch projects kind as ::text and ref_id as uuid (NULL::uuid where absent)
     * so the column types align across all five SELECTs.
     * Bundle bookings (custom_total_price set) collapse to ONE line at the bundle
     * price when any line is unpaid (lockstep, decision #2); non-bundle bookings
     * expand per line.
     */
    @Query(value = """
        SELECT b.booking_id AS booking_id,
               b.start_time AS occurred_at,
               CASE WHEN so.name IS NOT NULL
                    THEN COALESCE(s.title, 'Servizio') || ' · ' || so.name
                    ELSE COALESCE(s.title, 'Servizio') END AS label,
               COALESCE(bs.price_override, so.price, s.price) AS price,
               'service'::text AS kind,
               bs.service_id   AS ref_id
        FROM booking_services bs
        JOIN bookings b ON b.booking_id = bs.booking_id
        LEFT JOIN services s         ON s.service_id = bs.service_id
        LEFT JOIN service_options so ON so.option_id = bs.option_id
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND b.custom_total_price IS NULL
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') <> ''
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') = regexp_replace(:phone, '[^0-9]', '', 'g')
          AND bs.paid = false

        UNION ALL
        SELECT b.booking_id, b.start_time,
               COALESCE(NULLIF(TRIM(b.custom_service_name), ''), 'Servizio personalizzato'),
               b.custom_service_price,
               'custom'::text, NULL::uuid
        FROM bookings b
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND b.custom_total_price IS NULL
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') <> ''
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') = regexp_replace(:phone, '[^0-9]', '', 'g')
          AND b.is_custom_service = true AND b.custom_service_paid = false

        UNION ALL
        SELECT b.booking_id, b.start_time,
               COALESCE(NULLIF(TRIM(cpa.custom_package_name), ''), so2.name, s2.title, 'Pacchetto'),
               CASE WHEN cpa.total_sessions > 0 THEN cpa.price_paid / cpa.total_sessions ELSE cpa.price_paid END,
               'package'::text, cpa.id
        FROM booking_package_link bpl
        JOIN bookings b ON b.booking_id = bpl.booking_id
        JOIN client_package_assignments cpa ON cpa.id = bpl.client_package_assignment_id
        LEFT JOIN service_options so2 ON so2.option_id = cpa.service_option_id
        LEFT JOIN services s2        ON s2.service_id = cpa.service_id
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND b.custom_total_price IS NULL
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') <> ''
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') = regexp_replace(:phone, '[^0-9]', '', 'g')
          AND bpl.paid = false AND cpa.paid_upfront = false

        UNION ALL
        -- Legacy principal: single-service booking whose only service is on
        -- bookings.service_id (no booking_services row); paid state on paid_in_store.
        SELECT b.booking_id, b.start_time,
               COALESCE(so.name, s.title, 'Servizio'),
               COALESCE(so.price, s.price),
               'legacy'::text, b.service_id
        FROM bookings b
        LEFT JOIN services s         ON s.service_id = b.service_id
        LEFT JOIN service_options so ON so.option_id = b.service_option_id
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND b.custom_total_price IS NULL
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') <> ''
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') = regexp_replace(:phone, '[^0-9]', '', 'g')
          AND b.service_id IS NOT NULL AND b.is_custom_service = false AND b.paid_in_store = false
          AND NOT EXISTS (SELECT 1 FROM booking_services bs2 WHERE bs2.booking_id = b.booking_id)

        UNION ALL
        SELECT b.booking_id, b.start_time,
               'Appuntamento (prezzo bundle)',
               b.custom_total_price,
               'bundle'::text, NULL::uuid
        FROM bookings b
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND b.custom_total_price IS NOT NULL
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') <> ''
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') = regexp_replace(:phone, '[^0-9]', '', 'g')
          AND (
                EXISTS (SELECT 1 FROM booking_services bs
                         WHERE bs.booking_id = b.booking_id AND bs.paid = false)
             OR EXISTS (SELECT 1 FROM booking_package_link bpl
                          JOIN client_package_assignments cpa ON cpa.id = bpl.client_package_assignment_id
                         WHERE bpl.booking_id = b.booking_id AND bpl.paid = false
                           AND cpa.paid_upfront = false)
             OR (b.is_custom_service = true AND b.custom_service_paid = false)
             OR (b.service_id IS NOT NULL AND b.is_custom_service = false AND b.paid_in_store = false
                   AND NOT EXISTS (SELECT 1 FROM booking_services bs2 WHERE bs2.booking_id = b.booking_id))
          )

        UNION ALL
        -- Block B (M3-4): standalone unpaid product sale (promotion_link_id IS NULL).
        -- Products are additive extras — NO custom_total_price guard, so a sale surfaces
        -- independently even on a bundle booking (settled on its own via salePaid).
        SELECT b.booking_id, b.start_time,
               '🛍️ ' || sl.product_name || CASE WHEN sl.quantity > 1 THEN ' ×' || sl.quantity::text ELSE '' END,
               sl.unit_price * sl.quantity,
               'sale'::text, sl.id
        FROM booking_sales sl
        JOIN bookings b ON b.booking_id = sl.booking_id
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND sl.promotion_link_id IS NULL AND sl.paid = false
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') <> ''
          AND regexp_replace(b.customer_phone, '[^0-9]', '', 'g') = regexp_replace(:phone, '[^0-9]', '', 'g')

        ORDER BY occurred_at DESC
        """, nativeQuery = true)
    List<Object[]> findArretratiForCustomer(@Param("phone") String phone);
}