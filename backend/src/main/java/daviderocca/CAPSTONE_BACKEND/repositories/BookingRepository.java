package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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

    // ===== Admin agenda (fetch join) =====
    @Query("""
        SELECT b
        FROM Booking b
        LEFT JOIN FETCH b.service s
        LEFT JOIN FETCH b.serviceOption so
        WHERE b.bookingStatus <> daviderocca.CAPSTONE_BACKEND.enums.BookingStatus.CANCELLED
          AND b.startTime < :to
          AND b.endTime   > :from
        ORDER BY b.startTime ASC
    """)
    List<Booking> findAgendaRangeWithDetails(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    // ===== Stripe =====
    Optional<Booking> findByStripeSessionId(String stripeSessionId);

    // ===== Expire HOLD =====
    List<Booking> findByBookingStatusAndExpiresAtBefore(BookingStatus status, LocalDateTime time);
}