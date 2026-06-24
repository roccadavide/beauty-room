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
 * Unit tests for {@link PackageInstallmentService#snapDatelessInstallments} (the
 * create-side "one rata per appointment" snap) and
 * {@link PackageInstallmentService#moveDueDate} (the reschedule-follow that moves
 * an unpaid rata off an appointment's old date onto its new one).
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
    private static final LocalDate FROM_DATE = LocalDate.of(2026, 6, 24);
    private static final LocalDate TO_DATE   = LocalDate.of(2026, 6, 26);

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
    // TC-4: moveDueDate — an unpaid rata on the old date moves onto the new date,
    // and only it is persisted.
    // =========================================================================
    @Test
    @DisplayName("TC-4: moveDueDate — unpaid rata on fromDate is moved to toDate")
    void move_unpaidOnFromDate_movesToToDate() {
        ClientPackageAssignment a1 = assignment();
        PackageInstallment unpaid = dated(a1, 0, false, FROM_DATE);

        when(installmentRepo.findByAssignmentIdInAndPaidFalseAndDueDate(any(), eq(FROM_DATE)))
                .thenReturn(List.of(unpaid));

        service.moveDueDate(List.of(a1.getId()), FROM_DATE, TO_DATE);

        assertThat(unpaid.getDueDate()).isEqualTo(TO_DATE);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PackageInstallment>> captor = ArgumentCaptor.forClass(List.class);
        verify(installmentRepo).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(unpaid);
    }

    // =========================================================================
    // TC-5: moveDueDate — a PAID rata on the old date is never touched. The derived
    // query already filters paid==false, so it isn't returned; the method moves and
    // saves only what the query returns.
    // =========================================================================
    @Test
    @DisplayName("TC-5: moveDueDate — paid rata on fromDate is not returned, not moved")
    void move_paidOnFromDate_isNotMoved() {
        ClientPackageAssignment a1 = assignment();
        PackageInstallment unpaid = dated(a1, 0, false, FROM_DATE);
        PackageInstallment paid   = dated(a1, 1, true,  FROM_DATE);

        // The query's paidFalse filter excludes the paid rata — mirror that here.
        when(installmentRepo.findByAssignmentIdInAndPaidFalseAndDueDate(any(), eq(FROM_DATE)))
                .thenReturn(List.of(unpaid));

        service.moveDueDate(List.of(a1.getId()), FROM_DATE, TO_DATE);

        assertThat(unpaid.getDueDate()).isEqualTo(TO_DATE);
        assertThat(paid.getDueDate()).isEqualTo(FROM_DATE); // untouched

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PackageInstallment>> captor = ArgumentCaptor.forClass(List.class);
        verify(installmentRepo).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(unpaid);
    }

    // =========================================================================
    // TC-6: moveDueDate — guards: equal dates, null dates, or null/empty ids all
    // short-circuit; the repo is never queried.
    // =========================================================================
    @Test
    @DisplayName("TC-6: moveDueDate — equal dates / null dates / empty ids → early return, repo untouched")
    void move_guard_earlyReturns() {
        UUID id = UUID.randomUUID();
        assertThatCode(() -> service.moveDueDate(List.of(id), FROM_DATE, FROM_DATE))
                .doesNotThrowAnyException();
        assertThatCode(() -> service.moveDueDate(null, FROM_DATE, TO_DATE))
                .doesNotThrowAnyException();
        assertThatCode(() -> service.moveDueDate(List.of(), FROM_DATE, TO_DATE))
                .doesNotThrowAnyException();
        assertThatCode(() -> service.moveDueDate(List.of(id), null, TO_DATE))
                .doesNotThrowAnyException();
        assertThatCode(() -> service.moveDueDate(List.of(id), FROM_DATE, null))
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

    /** A dated rata at the given position / paid-state / due-date on the assignment. */
    private static PackageInstallment dated(ClientPackageAssignment assignment, int position,
                                            boolean paid, LocalDate dueDate) {
        PackageInstallment inst = new PackageInstallment();
        inst.setAssignment(assignment);
        inst.setPosition(position);
        inst.setPaid(paid);
        inst.setDueDate(dueDate);
        inst.setAmount(new BigDecimal("50.00"));
        return inst;
    }
}
