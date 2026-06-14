package daviderocca.beautyroom.packages;

import java.time.LocalDate;

/**
 * Settle payload for marking an installment paid. Both fields optional:
 * paidDate defaults to today, paymentMethod defaults to the existing value.
 */
public record PackageInstallmentSettleDTO(
        LocalDate paidDate,
        String paymentMethod
) {}
