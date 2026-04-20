package daviderocca.beautyroom.DTO.productDTOs;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ProductOptionResponse(
        UUID productOptionId,
        String name,
        String optionGroup,
        BigDecimal price,
        Integer stock,
        String imageUrl,
        Boolean active,
        Instant createdAt
) {}
