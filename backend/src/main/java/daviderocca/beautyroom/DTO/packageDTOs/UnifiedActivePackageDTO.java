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
        UUID linkedUserId,
        // V62 Fix 1: drives the "Già pagato" lock in the drawer at SELECTION time.
        //   • ADMIN source → assignment.paidUpfront verbatim
        //   • ONLINE source → always TRUE (PackageCredit is paid up front via Stripe)
        // Same predicate the drawer already used; we were just missing the data on
        // this DTO in create mode (ClientPackageAssignmentDTO carries it for edit).
        boolean paidUpfront
) {}
