package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    List<Booking> findByCustomerEmail(String customerEmail);

    List<Booking> findByStartTimeLessThanAndEndTimeGreaterThan(LocalDateTime endExclusive, LocalDateTime startExclusive);

    @Query("SELECT b FROM Booking b " +
            "WHERE b.service.serviceId = :serviceId " +
            "AND b.startTime < :endTime " +
            "AND b.endTime > :startTime")
    List<Booking> findOverlappingBookings(UUID serviceId, LocalDateTime startTime, LocalDateTime endTime);
}
