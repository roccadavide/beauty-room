package daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs;

import java.math.BigDecimal;
import java.util.UUID;

public record ServiceOptionResponseDTO(
        UUID optionId,
        String name,
        BigDecimal price,
        Integer sessions,
        String gender,
        boolean active,
        // FIX-2: gruppo/zona per raggruppare visivamente le opzioni (es. "Gambe", "Ascelle")
        String optionGroup
) {}