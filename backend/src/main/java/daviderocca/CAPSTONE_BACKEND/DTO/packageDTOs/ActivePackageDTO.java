package daviderocca.CAPSTONE_BACKEND.DTO.packageDTOs;

import daviderocca.CAPSTONE_BACKEND.enums.PackageCreditStatus;
import java.time.LocalDateTime;
import java.util.UUID;

public record ActivePackageDTO(
    UUID packageCreditId,
    String customerEmail,
    String customerName,
    String customerPhone,
    String serviceName,
    String serviceOptionName,
    int sessionsTotal,
    int sessionsRemaining,
    PackageCreditStatus status,
    LocalDateTime purchasedAt,
    LocalDateTime expiryDate
) {}
