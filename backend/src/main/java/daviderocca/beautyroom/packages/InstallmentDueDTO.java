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
 * {@code paid} / {@code paidDate} / {@code note} (Phase 5) let the feed carry both
 * still-due and settled-in-range rows: the agenda shows "saldato" vs "da saldare",
 * the settle date, and the installment note, and keeps a rata settled today in its KPI.
 */
public record InstallmentDueDTO(
        UUID installmentId,
        UUID packageAssignmentId,
        String clientName,
        String packageName,
        BigDecimal amount,
        LocalDate dueDate,
        BigDecimal total,
        BigDecimal remaining,
        boolean paid,
        LocalDate paidDate,
        String note
) {}
