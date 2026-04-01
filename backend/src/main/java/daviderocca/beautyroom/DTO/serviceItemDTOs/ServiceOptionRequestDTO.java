package daviderocca.beautyroom.DTO.serviceItemDTOs;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

import java.util.List;

public record ServiceOptionRequestDTO(
        @NotBlank String name,
        @NotNull BigDecimal price,
        @NotNull @Min(1) Integer sessions,
        String optionGroup,
        String gender,
        boolean active,
        /** Badge attivi, es. ["new","sale"]. Valori ammessi: new, sale, promo, limited, bestseller, coming_soon */
        List<String> badges
) {}
