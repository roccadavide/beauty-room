package daviderocca.beautyroom.DTO.wishlistDTOs;

import daviderocca.beautyroom.enums.WishlistItemType;

import java.util.UUID;

public record WishlistStatDTO(
        WishlistItemType itemType,
        UUID itemId,
        String itemName,
        long count
) {}
