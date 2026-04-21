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
}