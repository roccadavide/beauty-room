package daviderocca.beautyroom.packages;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Create/update payload for a package installment. position is server-assigned.
 * paid/paidDate are optional — they support the "create already paid" case
 * (e.g. seeding an upfront payment) and are normalized server-side.
 */
public record PackageInstallmentRequestDTO(
        @NotNull @DecimalMin(value = "0.00") BigDecimal amount,
        // Phase 5d: optional — absent/null means "da definire" (no due date yet).
        LocalDate dueDate,
        Boolean paid,
        LocalDate paidDate,
        String paymentMethod,
        String note
) {}
