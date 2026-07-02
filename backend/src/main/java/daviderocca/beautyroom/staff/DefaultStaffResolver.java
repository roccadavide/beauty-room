package daviderocca.beautyroom.staff;

import daviderocca.beautyroom.enums.Role;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Resolves which {@link StaffMember} a new Booking / PersonalAppointment /
 * BookingSale belongs to, until the write paths accept an explicit staff
 * (prompt 08+). Fallback chain:
 *
 * <ol>
 *   <li>the explicit staff, when the caller already has one;</li>
 *   <li>the single ACTIVE staff member (today's reality: only Michela);</li>
 *   <li>the staff row linked to the ADMIN user (WARN — 0 or 2+ active staff
 *       means a later prompt should be supplying the staff explicitly);</li>
 *   <li>{@code null} (WARN) — keeps prompt 01 inert when no staff row exists
 *       yet (e.g. fresh test schema without the V82 seed).</li>
 * </ol>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DefaultStaffResolver {

    private final StaffMemberRepository staffMemberRepository;

    /** Explicit staff wins; otherwise falls through to {@link #resolveDefault()}. */
    public StaffMember resolve(StaffMember explicitOrNull) {
        if (explicitOrNull != null) return explicitOrNull;
        return resolveDefault();
    }

    public StaffMember resolveDefault() {
        List<StaffMember> active = staffMemberRepository.findByActiveTrueOrderBySortOrderAsc();
        if (active.size() == 1) return active.get(0);

        StaffMember adminStaff = staffMemberRepository.findFirstByUser_Role(Role.ADMIN).orElse(null);
        if (adminStaff != null) {
            log.warn("DefaultStaffResolver: {} active staff members — falling back to the ADMIN-linked staff row {}",
                    active.size(), adminStaff.getId());
            return adminStaff;
        }

        log.warn("DefaultStaffResolver: no active staff and no ADMIN-linked staff row — staff left NULL");
        return null;
    }
}
