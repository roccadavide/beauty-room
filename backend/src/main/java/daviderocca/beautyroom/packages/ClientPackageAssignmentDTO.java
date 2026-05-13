package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.enums.ClientPackageStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record ClientPackageAssignmentDTO(
        UUID id,
        String clientName,
        UUID serviceOptionId,
        String serviceOptionName,
        String serviceTitle,
        UUID serviceId,
        String customPackageName,
        String displayName,
        int totalSessions,
        int sessionsRemaining,
        BigDecimal pricePaid,
        String notes,
        ClientPackageStatus status,
        UUID linkedUserId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
