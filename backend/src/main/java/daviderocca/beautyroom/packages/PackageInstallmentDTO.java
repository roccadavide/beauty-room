package daviderocca.beautyroom.packages;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Response shape for one recorded payment of a client package.
 */
public record PackageInstallmentDTO(
        UUID id,
        UUID packageAssignmentId,
        BigDecimal amount,
        LocalDate dueDate,
        boolean paid,
        LocalDate paidDate,
        String paymentMethod,
        String note,
        int position,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
