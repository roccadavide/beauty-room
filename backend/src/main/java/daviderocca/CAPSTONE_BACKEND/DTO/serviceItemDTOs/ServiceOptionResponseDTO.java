package daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs;

import java.math.BigDecimal;
import java.util.UUID;

public record ServiceOptionResponseDTO(
        UUID optionId,
        String name,
        BigDecimal price,
        Integer sessions,
        String gender,
        boolean active
) {}