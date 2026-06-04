package daviderocca.beautyroom.DTO.bookingDTOs;

import java.util.Map;
import java.util.UUID;

/**
 * Request for the completion-drawer settle action (PATCH /admin/bookings/{id}/settle).
 *
 * Two modes:
 *   - Bulk / lockstep: {@code markAllPaid} non-null sets every editable line to
 *     that value. ALSO forced server-side when the booking has a custom total
 *     price (bundle): the per-line maps are ignored and all lines move together
 *     (the value is markAllPaid, or the first toggle found, default false).
 *   - Per-line (non-bundle only): {@code servicePaid} keyed by catalog service id,
 *     {@code packageSessionPaid} keyed by ClientPackageAssignment id, plus
 *     {@code customServicePaid} for the free-form line.
 *
 * {@code alsoComplete} also transitions the booking to COMPLETED (idempotent).
 */
public record SettlementRequestDTO(
        Boolean markAllPaid,
        Map<UUID, Boolean> servicePaid,
        Map<UUID, Boolean> packageSessionPaid,
        Boolean customServicePaid,
        boolean alsoComplete,
        Map<UUID, Boolean> promotionPaid   // per-promotion paid toggle, keyed by promotionId (08.2b)
) {}
