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
        // Per-session duration override saved on the package itself. Null for ONLINE packages
        // (no equivalent on PackageCredit) and null for ADMIN packages without an override.
        Integer sessionDurationMin,
        String status,
        String source,          // "ADMIN" (ClientPackageAssignment) or "ONLINE" (PackageCredit)
        // ADMIN-only fields (null for ONLINE packages)
        String clientName,
        String customPackageName,
        BigDecimal pricePaid,
        String notes,
        UUID linkedUserId
) {}
