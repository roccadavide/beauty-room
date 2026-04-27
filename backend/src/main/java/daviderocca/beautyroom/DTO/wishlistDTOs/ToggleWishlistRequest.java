package daviderocca.beautyroom.DTO.wishlistDTOs;

import daviderocca.beautyroom.enums.WishlistItemType;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ToggleWishlistRequest(
        @NotNull WishlistItemType itemType,
        @NotNull UUID itemId
) {}
