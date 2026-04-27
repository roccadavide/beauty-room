package daviderocca.beautyroom.DTO.wishlistDTOs;

import java.util.List;

public record WishlistResponseDTO(
        List<WishlistItemDTO> items,
        int total
) {}
