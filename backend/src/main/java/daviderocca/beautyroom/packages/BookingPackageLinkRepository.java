package daviderocca.beautyroom.packages;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingPackageLinkRepository extends JpaRepository<BookingPackageLink, UUID> {

    // Singular legacy lookups — kept for the dormant decrementSessionOnCompletion path
    // and for callers that still assume one link per booking.
    Optional<BookingPackageLink> findByBookingBookingId(UUID bookingId);

    @Query("SELECT l FROM BookingPackageLink l " +
           "JOIN FETCH l.assignment a " +
           "LEFT JOIN FETCH a.serviceOption " +
           "WHERE l.booking.bookingId = :bookingId")
    Optional<BookingPackageLink> findByBookingBookingIdWithAssignment(@Param("bookingId") UUID bookingId);

    // Plural lookups — Phase 5a (N in-person package links per booking).
    List<BookingPackageLink> findAllByBookingBookingId(UUID bookingId);

    @Query("SELECT l FROM BookingPackageLink l " +
           "JOIN FETCH l.assignment a " +
           "LEFT JOIN FETCH a.serviceOption " +
           "WHERE l.booking.bookingId = :bookingId")
    List<BookingPackageLink> findAllByBookingBookingIdWithAssignment(@Param("bookingId") UUID bookingId);

    List<BookingPackageLink> findByAssignmentIdOrderByLinkedAtDesc(UUID assignmentId);

    @Query("SELECT l FROM BookingPackageLink l JOIN FETCH l.booking WHERE l.assignment.id = :assignmentId")
    List<BookingPackageLink> findByAssignmentIdWithBooking(@Param("assignmentId") UUID assignmentId);
}
