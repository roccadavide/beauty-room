package daviderocca.beautyroom.packages;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Per-package installment summary, batched so the agenda can render
 * "Pagato €collected su €total totali" (and "✓ Già pagato") on every
 * INSTALLMENTS card regardless of whether a rata falls due that day.
 *   total      — the package's agreed gross (assignment.pricePaid, or 0 when unset).
 *   collected  — Σ amount of its PAID installments.
 *   remaining  — total − collected (still owed).
 *   fullyPaid  — total > 0 && collected ≥ total.
 *   hasOpenDue — some UNPAID installment is due today or overdue (the "Completa" gate).
 */
public record PackageInstallmentBatchSummaryDTO(
        UUID packageAssignmentId,
        BigDecimal total,
        BigDecimal collected,
        BigDecimal remaining,
        boolean fullyPaid,
        boolean hasOpenDue
) {}
