package daviderocca.CAPSTONE_BACKEND.DTO.packageDTOs;

import daviderocca.CAPSTONE_BACKEND.enums.PackageCreditStatus;

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
