package daviderocca.beautyroom;

import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.staff.DefaultStaffResolver;
import daviderocca.beautyroom.staff.StaffMember;
import daviderocca.beautyroom.staff.StaffMemberRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * P01 (multi-staff): the DefaultStaffResolver fallback chain —
 * explicit staff → single ACTIVE staff → ADMIN-linked staff row → null.
 */
@ExtendWith(MockitoExtension.class)
class DefaultStaffResolverTest {

    @Mock
    private StaffMemberRepository staffMemberRepository;

    @InjectMocks
    private DefaultStaffResolver resolver;

    @Test
    @DisplayName("P01: explicit staff wins — no repository lookup at all")
    void explicitStaff_wins() {
        StaffMember explicit = new StaffMember("Giulia", true, 1);

        assertThat(resolver.resolve(explicit)).isSameAs(explicit);
        verifyNoInteractions(staffMemberRepository);
    }

    @Test
    @DisplayName("P01: exactly one active staff — that one is the default")
    void singleActiveStaff_isDefault() {
        StaffMember michela = new StaffMember("Michela", true, 0);
        when(staffMemberRepository.findByActiveTrueOrderBySortOrderAsc()).thenReturn(List.of(michela));

        assertThat(resolver.resolve(null)).isSameAs(michela);
    }

    @Test
    @DisplayName("P01: two active staff — falls back to the ADMIN-linked staff row")
    void multipleActiveStaff_fallsBackToAdminLinkedRow() {
        StaffMember michela = new StaffMember("Michela", true, 0);
        StaffMember giulia  = new StaffMember("Giulia", true, 1);
        when(staffMemberRepository.findByActiveTrueOrderBySortOrderAsc()).thenReturn(List.of(michela, giulia));
        when(staffMemberRepository.findFirstByUser_Role(Role.ADMIN)).thenReturn(Optional.of(michela));

        assertThat(resolver.resolveDefault()).isSameAs(michela);
    }

    @Test
    @DisplayName("P01: zero active staff — ADMIN-linked row still resolves")
    void zeroActiveStaff_fallsBackToAdminLinkedRow() {
        StaffMember michela = new StaffMember("Michela", false, 0);
        when(staffMemberRepository.findByActiveTrueOrderBySortOrderAsc()).thenReturn(List.of());
        when(staffMemberRepository.findFirstByUser_Role(Role.ADMIN)).thenReturn(Optional.of(michela));

        assertThat(resolver.resolveDefault()).isSameAs(michela);
    }

    @Test
    @DisplayName("P01: no staff rows at all — resolves to null (prompt 01 stays inert)")
    void noStaffRows_resolvesToNull() {
        when(staffMemberRepository.findByActiveTrueOrderBySortOrderAsc()).thenReturn(List.of());
        when(staffMemberRepository.findFirstByUser_Role(Role.ADMIN)).thenReturn(Optional.empty());

        assertThat(resolver.resolveDefault()).isNull();
    }
}
