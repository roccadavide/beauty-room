package daviderocca.CAPSTONE_BACKEND.DTO.productDTOs;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ProductResponseDTO(
        UUID productId,
        String name,
        BigDecimal price,
        String shortDescription,
        String description,
        List<String> images,
        int stock,
        UUID categoryId
) {}
