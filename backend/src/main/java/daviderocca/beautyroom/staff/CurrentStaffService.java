package daviderocca.beautyroom.staff;

import daviderocca.beautyroom.entities.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Staff identity resolution (prompt 02): authenticated User -> their staff row
 * via staff_members.user_id. Michela's ADMIN user links to her staff row; a User
 * with no staff row (customers, not-yet-linked accounts) resolves to empty.
 *
 * <p>open-in-view is off: callers outside a transaction must consume scalar
 * fields only (id, displayName, color, ...) — the user association is LAZY.</p>
 */
@Service
@RequiredArgsConstructor
public class CurrentStaffService {

    private final StaffMemberRepository staffMemberRepository;

    @Transactional(readOnly = true)
    public Optional<StaffMember> resolveFor(User user) {
        if (user == null || user.getUserId() == null) return Optional.empty();
        return staffMemberRepository.findByUser_UserId(user.getUserId());
    }
}
