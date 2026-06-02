package daviderocca.beautyroom.DTO.customerDTOs;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One unsettled line on a past COMPLETED booking (derived, no table).
 * price may be null when the source line has no resolvable price.
 *
 * {@code kind} (service|custom|package|legacy|bundle) + {@code refId} identify which
 * flag the per-row "Salda" action flips, mirroring the CompletionDrawer settle vocabulary:
 *   service/legacy → refId = catalog service_id  → servicePaid{refId:true}
 *   package        → refId = ClientPackageAssignment id → packageSessionPaid{refId:true}
 *   custom         → refId null → customServicePaid:true
 *   bundle         → refId null → markAllPaid:true (lockstep, enforced server-side)
 */
public record ArretratoLineDTO(
        UUID bookingId,
        LocalDateTime occurredAt,
        String label,
        BigDecimal price,
        String kind,
        UUID refId
) {}
