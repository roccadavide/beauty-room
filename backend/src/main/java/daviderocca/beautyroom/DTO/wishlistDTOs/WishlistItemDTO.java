package daviderocca.beautyroom.DTO.wishlistDTOs;

import daviderocca.beautyroom.enums.WishlistItemType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record WishlistItemDTO(
        UUID id,
        WishlistItemType itemType,
        UUID itemId,
        LocalDateTime createdAt,
        // dati arricchiti dall'entità
        String name,
        String description,
        String imageUrl,
        BigDecimal price,
        Integer durationMin,
        UUID linkId,
        boolean isActive,
        String category
) {}
