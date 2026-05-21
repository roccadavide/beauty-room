package daviderocca.beautyroom.DTO.bookingDTOs;

import java.util.UUID;

/**
 * One composition line of a client package, exposed alongside the booking
 * for the admin agenda card. Descriptive only — no per-item counter/price.
 */
public record PackageItemSummaryDTO(
        int position,
        UUID serviceId,
        String serviceTitle,
        UUID serviceOptionId,
        String serviceOptionName,
        String customName
) {}
