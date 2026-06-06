package daviderocca.beautyroom.promotions;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BookingPromotionLinkRepository extends JpaRepository<BookingPromotionLink, UUID> {

    List<BookingPromotionLink> findAllByBookingBookingId(UUID bookingId);

    // Mirrors BookingPackageLinkRepository.findAllByBookingBookingIdWithAssignment, but
    // LEFT JOIN FETCH since `promotion` is nullable (it survives promotion deletion).
    // `items` is left lazy, matching the package repo (which fetches only the parent ref).
    @Query("SELECT l FROM BookingPromotionLink l " +
           "LEFT JOIN FETCH l.promotion " +
           "WHERE l.booking.bookingId = :bookingId")
    List<BookingPromotionLink> findAllByBookingBookingIdWithPromotion(@Param("bookingId") UUID bookingId);
}
