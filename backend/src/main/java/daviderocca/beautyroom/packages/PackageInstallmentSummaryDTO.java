package daviderocca.beautyroom.packages;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Aggregate view over a package's installments.
 *   total       — the agreed gross total (assignment.pricePaid, or 0 when unset).
 *   scheduled   — sum of all installment amounts.
 *   collected   — sum of paid installment amounts.
 *   remaining   — total − collected (still owed).
 *   unscheduled — total − scheduled (amount not yet broken into installments).
 *   nextDueDate — earliest due date among unpaid installments (nullable).
 */
public record PackageInstallmentSummaryDTO(
        BigDecimal total,
        BigDecimal scheduled,
        BigDecimal collected,
        BigDecimal remaining,
        BigDecimal unscheduled,
        int count,
        int paidCount,
        LocalDate nextDueDate
) {}
