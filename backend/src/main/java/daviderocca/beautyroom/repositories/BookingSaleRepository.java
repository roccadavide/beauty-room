package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.BookingSale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BookingSaleRepository extends JpaRepository<BookingSale, UUID> {

    List<BookingSale> findByBookingIdOrderByAddedAtDesc(UUID bookingId);

    void deleteByIdAndBookingId(UUID id, UUID bookingId);
}
