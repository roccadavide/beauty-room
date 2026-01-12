package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.WorkingHours;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.DayOfWeek;
import java.util.Optional;
import java.util.UUID;

public interface WorkingHoursRepository extends JpaRepository<WorkingHours, UUID> {
    Optional<WorkingHours> findByDayOfWeek(DayOfWeek dayOfWeek);

    boolean existsByDayOfWeek(DayOfWeek dayOfWeek);
}