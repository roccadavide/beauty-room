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
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    // -------------------- BASIC --------------------
    List<Booking> findByCustomerEmailIgnoreCase(String customerEmail);

    // -------------------- OVERLAP (CREATE) - LOCK (STATUS BLOCCANTI) --------------------
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

    // -------------------- OVERLAP (UPDATE) - LOCK (STATUS BLOCCANTI) --------------------
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

    // -------------------- AVAILABILITY (RANGE) - STATUS BLOCCANTI --------------------
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

    // -------------------- AGENDA ADMIN (FETCH JOIN PER PERFORMANCE) --------------------
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
}