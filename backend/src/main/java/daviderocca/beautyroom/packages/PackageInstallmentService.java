package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.enums.ClientPackageStatus;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
     * Cross-package feed of unpaid installments due in [from, to] for the agenda's
     * "installments due" panel. CANCELLED packages are excluded at the query level.
     */
    @Transactional(readOnly = true)
    public List<InstallmentDueDTO> getInstallmentsDue(LocalDate from, LocalDate to) {
        List<PackageInstallment> due =
                installmentRepo.findUnpaidDueBetween(from, to, ClientPackageStatus.CANCELLED);

        // "collected" per package = Σ of its paid installments. One batched query over
        // the distinct due assignments (already in the L1 cache from the fetch-join
        // above), summed in Java → 2 statements total, no N+1.
        List<UUID> assignmentIds = due.stream()
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

        return due.stream()
                .map(i -> toDueDTO(i, collectedByAssignment))
                .toList();
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
                remaining);
    }
}
