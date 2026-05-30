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

    /** True if the customer has any unsettled line on a past COMPLETED booking. */
    @Query(value = """
        SELECT EXISTS (
            SELECT 1
            FROM bookings b
            WHERE b.booking_status = 'COMPLETED'
              AND b.paid_at IS NULL
              AND b.package_credit_id IS NULL
              AND LOWER(b.customer_email) = LOWER(:email)
              AND (
                    EXISTS (SELECT 1 FROM booking_services bs
                             WHERE bs.booking_id = b.booking_id AND bs.paid = false)
                 OR EXISTS (SELECT 1 FROM booking_package_link bpl
                              JOIN client_package_assignments cpa ON cpa.id = bpl.assignment_id
                             WHERE bpl.booking_id = b.booking_id AND bpl.paid = false
                               AND cpa.paid_upfront = false)
                 OR (b.is_custom_service = true AND b.custom_service_paid = false)
              )
        )
        """, nativeQuery = true)
    boolean existsUnsettledCompletedLinesForCustomer(@Param("email") String email);

    /**
     * Itemised unsettled lines for a customer's COMPLETED bookings.
     * Columns: [booking_id (uuid), occurred_at (timestamp), label (text), price (numeric)].
     * Bundle bookings (custom_total_price set) collapse to ONE line at the bundle
     * price when any line is unpaid (lockstep, decision #2); non-bundle bookings
     * expand per line.
     */
    @Query(value = """
        SELECT b.booking_id AS booking_id,
               b.start_time AS occurred_at,
               COALESCE(so.name, s.title, 'Servizio') AS label,
               COALESCE(bs.price_override, so.price, s.price) AS price
        FROM booking_services bs
        JOIN bookings b ON b.booking_id = bs.booking_id
        LEFT JOIN services s         ON s.service_id = bs.service_id
        LEFT JOIN service_options so ON so.option_id = bs.option_id
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND b.custom_total_price IS NULL
          AND LOWER(b.customer_email) = LOWER(:email)
          AND bs.paid = false

        UNION ALL
        SELECT b.booking_id, b.start_time,
               COALESCE(NULLIF(TRIM(b.custom_service_name), ''), 'Servizio personalizzato'),
               b.custom_service_price
        FROM bookings b
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND b.custom_total_price IS NULL
          AND LOWER(b.customer_email) = LOWER(:email)
          AND b.is_custom_service = true AND b.custom_service_paid = false

        UNION ALL
        SELECT b.booking_id, b.start_time,
               COALESCE(NULLIF(TRIM(cpa.custom_package_name), ''), so2.name, s2.title, 'Pacchetto'),
               CASE WHEN cpa.total_sessions > 0 THEN cpa.price_paid / cpa.total_sessions ELSE cpa.price_paid END
        FROM booking_package_link bpl
        JOIN bookings b ON b.booking_id = bpl.booking_id
        JOIN client_package_assignments cpa ON cpa.id = bpl.assignment_id
        LEFT JOIN service_options so2 ON so2.option_id = cpa.service_option_id
        LEFT JOIN services s2        ON s2.service_id = cpa.service_id
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND b.custom_total_price IS NULL
          AND LOWER(b.customer_email) = LOWER(:email)
          AND bpl.paid = false AND cpa.paid_upfront = false

        UNION ALL
        SELECT b.booking_id, b.start_time,
               'Appuntamento (prezzo bundle)',
               b.custom_total_price
        FROM bookings b
        WHERE b.booking_status = 'COMPLETED' AND b.paid_at IS NULL AND b.package_credit_id IS NULL
          AND b.custom_total_price IS NOT NULL
          AND LOWER(b.customer_email) = LOWER(:email)
          AND (
                EXISTS (SELECT 1 FROM booking_services bs
                         WHERE bs.booking_id = b.booking_id AND bs.paid = false)
             OR EXISTS (SELECT 1 FROM booking_package_link bpl
                          JOIN client_package_assignments cpa ON cpa.id = bpl.assignment_id
                         WHERE bpl.booking_id = b.booking_id AND bpl.paid = false
                           AND cpa.paid_upfront = false)
             OR (b.is_custom_service = true AND b.custom_service_paid = false)
          )

        ORDER BY occurred_at DESC
        """, nativeQuery = true)
    List<Object[]> findArretratiForCustomer(@Param("email") String email);
}