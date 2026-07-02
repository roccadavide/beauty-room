package daviderocca.beautyroom.staff;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StaffWorkingHoursRepository extends JpaRepository<StaffWorkingHours, UUID> {

    List<StaffWorkingHours> findByStaffMember_Id(UUID staffId);

    // Team API (prompt 03): per-day upsert + the §3.5 dual-write mirror.
    Optional<StaffWorkingHours> findByStaffMember_IdAndDayOfWeek(UUID staffId, DayOfWeek dayOfWeek);
}
