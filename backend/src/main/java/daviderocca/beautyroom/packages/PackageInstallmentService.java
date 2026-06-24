package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.enums.ClientPackageStatus;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * CRUD + settlement for the package installment registry. Standalone — does not
 * touch the per-session / UPFRONT settlement flow, the agenda, or the report
 * (those remain on ClientPackageService and are out of scope for this phase).
 */
@Service
@RequiredArgsConstructor
public class PackageInstallmentService {

    private final PackageInstallmentRepository installmentRepo;
    private final ClientPackageAssignmentRepository assignmentRepo;

    // ── Read ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PackageInstallmentDTO> getInstallments(UUID assignmentId) {
        requireAssignment(assignmentId);
        return installmentRepo.findByAssignmentIdOrderByPositionAscDueDateAsc(assignmentId)
                .stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public PackageInstallmentSummaryDTO getSummary(UUID assignmentId) {
        ClientPackageAssignment assignment = requireAssignment(assignmentId);
        List<PackageInstallment> installments =
                installmentRepo.findByAssignmentIdOrderByPositionAscDueDateAsc(assignmentId);

        BigDecimal total = assignment.getPricePaid() != null ? assignment.getPricePaid() : BigDecimal.ZERO;
        BigDecimal scheduled = BigDecimal.ZERO;
        BigDecimal collected = BigDecimal.ZERO;
        int paidCount = 0;
        LocalDate nextDueDate = null;
        for (PackageInstallment inst : installments) {
            BigDecimal amount = inst.getAmount() != null ? inst.getAmount() : BigDecimal.ZERO;
            scheduled = scheduled.add(amount);
            if (inst.isPaid()) {
                collected = collected.add(amount);
                paidCount++;
            } else if (inst.getDueDate() != null
                    && (nextDueDate == null || inst.getDueDate().isBefore(nextDueDate))) {
                nextDueDate = inst.getDueDate();
            }
        }
        return new PackageInstallmentSummaryDTO(
                total,
                scheduled,
                collected,
                total.subtract(collected),
                total.subtract(scheduled),
                installments.size(),
                paidCount,
                nextDueDate);
    }

    /**
     * Cross-package feed of installments RELEVANT to [from, to] for the agenda's
     * "installments due" panel: the union of two disjoint sets — unpaid due in range
     * (paid = false) and paid in range by paidDate (paid = true). Keeping a rata
     * settled today in the feed lets the agenda KPI stay counted. CANCELLED packages
     * are excluded at the query level; the paid flag is mutually exclusive so a given
     * installment lands in exactly one set (no double-count).
     */
    @Transactional(readOnly = true)
    public List<InstallmentDueDTO> getInstallmentsDue(LocalDate from, LocalDate to) {
        List<PackageInstallment> unpaidDue =
                installmentRepo.findUnpaidDueBetween(from, to, ClientPackageStatus.CANCELLED);
        List<PackageInstallment> paidInRange =
                installmentRepo.findPaidByPaidDateBetween(from, to, ClientPackageStatus.CANCELLED);

        // "collected" per package = Σ of its paid installments. One batched query over
        // the distinct assignments across BOTH result sets (already in the L1 cache
        // from the fetch-joins above), summed in Java → still no N+1.
        List<UUID> assignmentIds = Stream.concat(unpaidDue.stream(), paidInRange.stream())
                .map(i -> i.getAssignment().getId())
                .distinct()
                .toList();
        Map<UUID, BigDecimal> collectedByAssignment = new HashMap<>();
        if (!assignmentIds.isEmpty()) {
            for (PackageInstallment paid : installmentRepo.findByAssignmentIdInAndPaidTrue(assignmentIds)) {
                BigDecimal amount = paid.getAmount() != null ? paid.getAmount() : BigDecimal.ZERO;
                collectedByAssignment.merge(paid.getAssignment().getId(), amount, BigDecimal::add);
            }
        }

        // Unpaid first (ordered by dueDate), then paid (ordered by paidDate). The DTO
        // carries the per-row paid flag straight off the entity, so each query's own
        // filter already pins it to false / true respectively.
        return Stream.concat(unpaidDue.stream(), paidInRange.stream())
                .map(i -> toDueDTO(i, collectedByAssignment))
                .toList();
    }

    /**
     * Per-package installment summaries for the requested assignments, so the agenda
     * can show "Pagato €collected su €total" (and the "Completa" gate) on every
     * INSTALLMENTS card. Two queries total: the assignments (for pricePaid — and so a
     * package with ZERO installments still gets a row) and all their installments,
     * grouped by assignment in Java. Ids not found are skipped; no N+1.
     */
    @Transactional(readOnly = true)
    public List<PackageInstallmentBatchSummaryDTO> getBatchSummaries(List<UUID> assignmentIds) {
        if (assignmentIds == null || assignmentIds.isEmpty()) {
            return List.of();
        }
        List<ClientPackageAssignment> assignments = assignmentRepo.findAllById(assignmentIds);
        List<PackageInstallment> installments = installmentRepo.findByAssignmentIdIn(assignmentIds);

        Map<UUID, List<PackageInstallment>> byAssignment = new HashMap<>();
        for (PackageInstallment inst : installments) {
            byAssignment.computeIfAbsent(inst.getAssignment().getId(), k -> new ArrayList<>()).add(inst);
        }

        LocalDate today = LocalDate.now();
        List<PackageInstallmentBatchSummaryDTO> result = new ArrayList<>();
        for (ClientPackageAssignment a : assignments) {
            BigDecimal total = a.getPricePaid() != null ? a.getPricePaid() : BigDecimal.ZERO;
            BigDecimal collected = BigDecimal.ZERO;
            boolean hasOpenDue = false;
            for (PackageInstallment inst : byAssignment.getOrDefault(a.getId(), List.of())) {
                BigDecimal amount = inst.getAmount() != null ? inst.getAmount() : BigDecimal.ZERO;
                if (inst.isPaid()) {
                    collected = collected.add(amount);
                } else if (inst.getDueDate() != null && !inst.getDueDate().isAfter(today)) {
                    // unpaid + due today or overdue → an open rata gates "Completa".
                    hasOpenDue = true;
                }
            }
            BigDecimal remaining = total.subtract(collected);
            boolean fullyPaid = total.compareTo(BigDecimal.ZERO) > 0 && collected.compareTo(total) >= 0;
            result.add(new PackageInstallmentBatchSummaryDTO(
                    a.getId(), total, collected, remaining, fullyPaid, hasOpenDue));
        }
        return result;
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    @Transactional
    public PackageInstallmentDTO create(UUID assignmentId, PackageInstallmentRequestDTO req) {
        ClientPackageAssignment assignment = requireAssignment(assignmentId);
        int nextPosition = installmentRepo.findByAssignmentIdOrderByPositionAscDueDateAsc(assignmentId)
                .stream().mapToInt(PackageInstallment::getPosition).max().orElse(-1) + 1;

        PackageInstallment inst = new PackageInstallment();
        inst.setAssignment(assignment);
        inst.setAmount(req.amount());
        inst.setDueDate(req.dueDate());
        inst.setPaymentMethod(req.paymentMethod());
        inst.setNote(req.note());
        inst.setPosition(nextPosition);
        applyPaidNormalization(inst, req.paid(), req.paidDate());

        return toDTO(installmentRepo.save(inst));
    }

    @Transactional
    public PackageInstallmentDTO update(UUID assignmentId, UUID installmentId, PackageInstallmentRequestDTO req) {
        PackageInstallment inst = requireInstallment(assignmentId, installmentId);
        inst.setAmount(req.amount());
        inst.setDueDate(req.dueDate());
        inst.setNote(req.note());
        inst.setPaymentMethod(req.paymentMethod());
        applyPaidNormalization(inst, req.paid(), req.paidDate());
        return toDTO(installmentRepo.save(inst));
    }

    @Transactional
    public PackageInstallmentDTO settle(UUID assignmentId, UUID installmentId, PackageInstallmentSettleDTO body) {
        PackageInstallment inst = requireInstallment(assignmentId, installmentId);
        inst.setPaid(true);
        inst.setPaidDate(body != null && body.paidDate() != null ? body.paidDate() : LocalDate.now());
        if (body != null && body.paymentMethod() != null) {
            inst.setPaymentMethod(body.paymentMethod());
        }
        return toDTO(installmentRepo.save(inst));
    }

    @Transactional
    public PackageInstallmentDTO unsettle(UUID assignmentId, UUID installmentId) {
        PackageInstallment inst = requireInstallment(assignmentId, installmentId);
        inst.setPaid(false);
        inst.setPaidDate(null);
        inst.setPaymentMethod(null);
        return toDTO(installmentRepo.save(inst));
    }

    @Transactional
    public void delete(UUID assignmentId, UUID installmentId) {
        PackageInstallment inst = requireInstallment(assignmentId, installmentId);
        installmentRepo.delete(inst);
    }

    /**
     * Phase 5d — snap a "da definire" (date-less) installment onto an appointment's
     * date. For each of the given packages, only the EARLIEST (lowest-position) UNPAID
     * rata with no due date gets its dueDate set to {@code date} (the booking just
     * created for that package), turning a floating rata back into an ordinary dated
     * one — so it resurfaces on its day, gates "Completa" there, and settles/postpones
     * normally. The remaining floating rate stay date-less, so successive appointments
     * snap successive rate (one per visit) instead of clustering the whole balance on
     * the first one. No-op when there are no packages or no date. Strictly additive:
     * dated rate are untouched.
     */
    @Transactional
    public void snapDatelessInstallments(Collection<UUID> assignmentIds, LocalDate date) {
        if (assignmentIds == null || assignmentIds.isEmpty() || date == null) {
            return;
        }
        List<PackageInstallment> dateless =
                installmentRepo.findByAssignmentIdInAndPaidFalseAndDueDateIsNull(assignmentIds);

        // One rata per appointment: for each assignment, pin only the earliest
        // (lowest-position) floating unpaid rata to this date; leave the rest
        // floating so they distribute across the package's subsequent appointments.
        Map<UUID, PackageInstallment> earliestPerAssignment = new HashMap<>();
        for (PackageInstallment inst : dateless) {
            UUID assignmentId = inst.getAssignment().getId();
            PackageInstallment current = earliestPerAssignment.get(assignmentId);
            if (current == null || inst.getPosition() < current.getPosition()) {
                earliestPerAssignment.put(assignmentId, inst);
            }
        }

        List<PackageInstallment> toSnap = new ArrayList<>(earliestPerAssignment.values());
        for (PackageInstallment inst : toSnap) {
            inst.setDueDate(date);
        }
        installmentRepo.saveAll(toSnap);
    }

    /**
     * Reschedule-follow: when an appointment moves, the unpaid rata pinned to its
     * old date moves with it. Writes only dueDate, only paid==false rate.
     */
    @Transactional
    public void moveDueDate(Collection<UUID> assignmentIds, LocalDate fromDate, LocalDate toDate) {
        if (assignmentIds == null || assignmentIds.isEmpty()
                || fromDate == null || toDate == null || fromDate.equals(toDate)) {
            return;
        }
        List<PackageInstallment> toMove =
                installmentRepo.findByAssignmentIdInAndPaidFalseAndDueDate(assignmentIds, fromDate);
        for (PackageInstallment inst : toMove) {
            inst.setDueDate(toDate);
        }
        installmentRepo.saveAll(toMove);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * paid==true  → paidDate = provided value, or today when absent.
     * paid!=true  → paidDate cleared.
     */
    private void applyPaidNormalization(PackageInstallment inst, Boolean paid, LocalDate paidDate) {
        boolean isPaid = Boolean.TRUE.equals(paid);
        inst.setPaid(isPaid);
        inst.setPaidDate(isPaid ? (paidDate != null ? paidDate : LocalDate.now()) : null);
    }

    private ClientPackageAssignment requireAssignment(UUID assignmentId) {
        return assignmentRepo.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ClientPackageAssignment not found: " + assignmentId));
    }

    /**
     * Loads the installment and verifies it belongs to the given assignment.
     * A mismatch is treated as "not found under this assignment" (same 404 type).
     */
    private PackageInstallment requireInstallment(UUID assignmentId, UUID installmentId) {
        requireAssignment(assignmentId);
        PackageInstallment inst = installmentRepo.findById(installmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "PackageInstallment not found: " + installmentId));
        if (inst.getAssignment() == null || !inst.getAssignment().getId().equals(assignmentId)) {
            throw new ResourceNotFoundException(
                    "PackageInstallment " + installmentId + " does not belong to assignment " + assignmentId);
        }
        return inst;
    }

    private PackageInstallmentDTO toDTO(PackageInstallment i) {
        return new PackageInstallmentDTO(
                i.getId(),
                i.getAssignment() != null ? i.getAssignment().getId() : null,
                i.getAmount(),
                i.getDueDate(),
                i.isPaid(),
                i.getPaidDate(),
                i.getPaymentMethod(),
                i.getNote(),
                i.getPosition(),
                i.getCreatedAt(),
                i.getUpdatedAt()
        );
    }

    /**
     * Flattens an installment + its parent assignment into the agenda "due" row.
     * packageName falls back customPackageName → service title → "Pacchetto".
     * total = the package's agreed gross (pricePaid, or ZERO); remaining = total −
     * collected, where collected is looked up from the pre-summed batch map.
     */
    private InstallmentDueDTO toDueDTO(PackageInstallment i, Map<UUID, BigDecimal> collectedByAssignment) {
        ClientPackageAssignment a = i.getAssignment();
        String packageName;
        if (a.getCustomPackageName() != null && !a.getCustomPackageName().isBlank()) {
            packageName = a.getCustomPackageName();
        } else if (a.getService() != null) {
            packageName = a.getService().getTitle();
        } else {
            packageName = "Pacchetto";
        }
        BigDecimal total = a.getPricePaid() != null ? a.getPricePaid() : BigDecimal.ZERO;
        BigDecimal collected = collectedByAssignment.getOrDefault(a.getId(), BigDecimal.ZERO);
        BigDecimal remaining = total.subtract(collected);
        return new InstallmentDueDTO(
                i.getId(),
                a.getId(),
                a.getClientName(),
                packageName,
                i.getAmount(),
                i.getDueDate(),
                total,
                remaining,
                i.isPaid(),
                i.getPaidDate(),
                i.getNote());
    }
}
