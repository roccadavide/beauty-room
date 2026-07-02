package daviderocca.beautyroom.staff;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StaffWorkingHoursRepository extends JpaRepository<StaffWorkingHours, UUID> {

    List<StaffWorkingHours> findByStaffMember_Id(UUID staffId);
}
