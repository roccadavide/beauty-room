package daviderocca.beautyroom;

import daviderocca.beautyroom.packages.ClientPackageAssignment;
import daviderocca.beautyroom.packages.ClientPackageAssignmentRepository;
import daviderocca.beautyroom.packages.PackageInstallment;
import daviderocca.beautyroom.packages.PackageInstallmentRepository;
import daviderocca.beautyroom.packages.PackageInstallmentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link PackageInstallmentService#snapDatelessInstallments}.
 * Covers the "one rata per appointment" distribution: only the earliest
 * (lowest-position) floating unpaid rata per assignment is dated; the rest keep
 * floating for subsequent visits.
 */
@ExtendWith(MockitoExtension.class)
class PackageInstallmentServiceTest {

    @Mock
    private PackageInstallmentRepository installmentRepo;

    @Mock
    private ClientPackageAssignmentRepository assignmentRepo;

    @InjectMocks
    private PackageInstallmentService service;

    private static final LocalDate SNAP_DATE = LocalDate.of(2026, 6, 24);

    // =========================================================================
    // TC-1: per-assignment earliest only — a booking linking two packages snaps
    // one rata from EACH, picking the lowest-position floating rata of each.
    // =========================================================================
    @Test
    @DisplayName("TC-1: snapDatelessInstallments — dates only the earliest floating rata per assignment")
    void snap_datesOnlyEarliestPerAssignment() {
        ClientPackageAssignment a1 = assignment();
        ClientPackageAssignment a2 = assignment();

        PackageInstallment a1p0 = floating(a1, 0);
        PackageInstallment a1p1 = floating(a1, 1);
        PackageInstallment a1p2 = floating(a1, 2);
        PackageInstallment a2p0 = floating(a2, 0);
        PackageInstallment a2p1 = floating(a2, 1);

        // Deliberately unsorted, so the test proves selection is by position —
        // not by the order the repository happened to return rows.
        when(installmentRepo.findByAssignmentIdInAndPaidFalseAndDueDateIsNull(any()))
                .thenReturn(List.of(a1p2, a1p0, a1p1, a2p1, a2p0));

        service.snapDatelessInstallments(List.of(a1.getId(), a2.getId()), SNAP_DATE);

        // earliest of each assignment gets the appointment date...
        assertThat(a1p0.getDueDate()).isEqualTo(SNAP_DATE);
        assertThat(a2p0.getDueDate()).isEqualTo(SNAP_DATE);
        // ...the rest stay floating (da definire) for subsequent appointments.
        assertThat(a1p1.getDueDate()).isNull();
        assertThat(a1p2.getDueDate()).isNull();
        assertThat(a2p1.getDueDate()).isNull();

        // and only those two are persisted.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PackageInstallment>> captor = ArgumentCaptor.forClass(List.class);
        verify(installmentRepo).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactlyInAnyOrder(a1p0, a2p0);
    }

    // =========================================================================
    // TC-2: no-op when nothing floats — empty result → no rata dated, no throw.
    // =========================================================================
    @Test
    @DisplayName("TC-2: snapDatelessInstallments — no floating rate → nothing dated, no exception")
    void snap_noFloating_isNoOp() {
        when(installmentRepo.findByAssignmentIdInAndPaidFalseAndDueDateIsNull(any()))
                .thenReturn(List.of());

        assertThatCode(() -> service.snapDatelessInstallments(List.of(UUID.randomUUID()), SNAP_DATE))
                .doesNotThrowAnyException();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PackageInstallment>> captor = ArgumentCaptor.forClass(List.class);
        verify(installmentRepo).saveAll(captor.capture());
        assertThat(captor.getValue()).isEmpty();
    }

    // =========================================================================
    // TC-3: guard — null/empty ids or null date short-circuit; repo never queried.
    // =========================================================================
    @Test
    @DisplayName("TC-3: snapDatelessInstallments — null/empty ids or null date → early return, repo untouched")
    void snap_guard_earlyReturns() {
        assertThatCode(() -> service.snapDatelessInstallments(null, SNAP_DATE))
                .doesNotThrowAnyException();
        assertThatCode(() -> service.snapDatelessInstallments(List.of(), SNAP_DATE))
                .doesNotThrowAnyException();
        assertThatCode(() -> service.snapDatelessInstallments(List.of(UUID.randomUUID()), null))
                .doesNotThrowAnyException();

        verifyNoInteractions(installmentRepo);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private static ClientPackageAssignment assignment() {
        ClientPackageAssignment a = new ClientPackageAssignment();
        a.setId(UUID.randomUUID());
        return a;
    }

    /** A floating (unpaid, date-less) rata at the given position on the assignment. */
    private static PackageInstallment floating(ClientPackageAssignment assignment, int position) {
        PackageInstallment inst = new PackageInstallment();
        inst.setAssignment(assignment);
        inst.setPosition(position);
        inst.setPaid(false);
        inst.setDueDate(null);
        inst.setAmount(new BigDecimal("50.00"));
        return inst;
    }
}
