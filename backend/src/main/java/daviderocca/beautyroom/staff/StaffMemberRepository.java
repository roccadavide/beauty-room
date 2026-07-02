package daviderocca.beautyroom.staff;

import daviderocca.beautyroom.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StaffMemberRepository extends JpaRepository<StaffMember, UUID> {

    // Staff identity resolution: authenticated User -> their staff row.
    Optional<StaffMember> findByUser_UserId(UUID userId);

    // I1 active-staff gate: every conditional surface keys off countByActiveTrue() >= 2.
    long countByActiveTrue();

    List<StaffMember> findByActiveTrueOrderBySortOrderAsc();

    // DefaultStaffResolver fallback: the staff row linked to the owner's ADMIN user.
    Optional<StaffMember> findFirstByUser_Role(Role role);
}
