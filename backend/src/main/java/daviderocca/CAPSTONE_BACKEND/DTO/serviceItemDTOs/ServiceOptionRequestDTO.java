package daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ServiceOptionRequestDTO(
        @NotBlank String name,
        @NotNull BigDecimal price,
        @NotNull @Min(1) Integer sessions,
        String optionGroup,
        String gender,
        boolean active
) {}
