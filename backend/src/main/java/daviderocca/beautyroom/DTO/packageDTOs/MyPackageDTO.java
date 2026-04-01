package daviderocca.beautyroom.DTO.packageDTOs;

import daviderocca.beautyroom.enums.PackageCreditStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record MyPackageDTO(
        UUID packageCreditId,
        String serviceName,
        String serviceOptionName,
        int sessionsTotal,
        int sessionsUsed,
        int sessionsRemaining,
        PackageCreditStatus status,
        LocalDateTime purchasedAt,
        LocalDateTime expiryDate
) {}
