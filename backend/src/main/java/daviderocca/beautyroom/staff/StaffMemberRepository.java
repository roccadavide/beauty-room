package daviderocca.beautyroom.staff;

import daviderocca.beautyroom.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    // Team API (prompt 03): admin list with qualifications + login email in one query
    // (open-in-view=false: both associations are LAZY, so fetch them here).
    @Query("""
        SELECT DISTINCT s FROM StaffMember s
        LEFT JOIN FETCH s.services
        LEFT JOIN FETCH s.user
        ORDER BY s.sortOrder ASC, s.displayName ASC
    """)
    List<StaffMember> findAllWithDetails();

    @Query("""
        SELECT s FROM StaffMember s
        LEFT JOIN FETCH s.services
        WHERE s.id = :id
    """)
    Optional<StaffMember> findByIdWithServices(@Param("id") UUID id);

    // Public list (prompt 03): active staff qualified for a service, in owner-defined order.
    @Query("""
        SELECT s FROM StaffMember s
        JOIN s.services svc
        WHERE s.active = true AND svc.serviceId = :serviceId
        ORDER BY s.sortOrder ASC, s.displayName ASC
    """)
    List<StaffMember> findActiveByServiceIdOrderBySortOrderAsc(@Param("serviceId") UUID serviceId);
}
