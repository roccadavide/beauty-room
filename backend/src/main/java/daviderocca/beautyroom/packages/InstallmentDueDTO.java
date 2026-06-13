package daviderocca.beautyroom.packages;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One unpaid installment due within a queried date range, flattened across all
 * packages for the agenda's "installments due" feed (Phase 2a, Part 2).
 * Read-only projection: clientName / packageName are resolved from the parent
 * assignment so the agenda can list rows and offer "salda" without a second call.
 * {@code total} / {@code remaining} (Phase 2b) carry the package's agreed gross
 * total and what is still owed (total − Σ paid installments) so the agenda can
 * render "residuo €Y di €Z" without an extra round-trip.
 */
public record InstallmentDueDTO(
        UUID installmentId,
        UUID packageAssignmentId,
        String clientName,
        String packageName,
        BigDecimal amount,
        LocalDate dueDate,
        BigDecimal total,
        BigDecimal remaining
) {}
