package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.BookingSale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BookingSaleRepository extends JpaRepository<BookingSale, UUID> {

    List<BookingSale> findByBookingIdOrderByAddedAtDesc(UUID bookingId);

    void deleteByIdAndBookingId(UUID id, UUID bookingId);
}
