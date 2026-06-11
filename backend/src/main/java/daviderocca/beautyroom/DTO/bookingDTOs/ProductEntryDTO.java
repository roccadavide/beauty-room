package daviderocca.beautyroom.DTO.bookingDTOs;

import java.util.UUID;

/**
 * Per-product entry in the PUBLIC multi-service booking checkout payload (mixed cart).
 * No price and no paid flag: the server resolves the charged price and the stock from the
 * {@link daviderocca.beautyroom.entities.Product} entity — the client never sets the amount.
 * Any extra field the client sends (e.g. {@code pickupDate}) is ignored on deserialization.
 */
public record ProductEntryDTO(
        UUID productId,
        int quantity
) {}
