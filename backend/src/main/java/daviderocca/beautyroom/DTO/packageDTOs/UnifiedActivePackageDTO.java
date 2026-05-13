package daviderocca.beautyroom.DTO.packageDTOs;

import java.math.BigDecimal;
import java.util.UUID;

public record UnifiedActivePackageDTO(
        UUID id,
        String displayName,
        String serviceTitle,
        UUID serviceOptionId,
        int totalSessions,
        int sessionsRemaining,
        String status,
        String source,          // "ADMIN" (ClientPackageAssignment) or "ONLINE" (PackageCredit)
        // ADMIN-only fields (null for ONLINE packages)
        String clientName,
        String customPackageName,
        BigDecimal pricePaid,
        String notes,
        UUID linkedUserId
) {}
