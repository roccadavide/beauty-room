package daviderocca.beautyroom.DTO.productDTOs;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ProductOptionRequest(
        @NotBlank String name,
        String optionGroup,
        BigDecimal price,
        @NotNull @Min(0) Integer stock,
        String imageUrl,
        Boolean active
) {}
