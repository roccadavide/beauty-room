package daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs;

import java.math.BigDecimal;
import java.util.UUID;

public record PackageResponseDTO(
        UUID optionId,
        UUID serviceId,
        String serviceName,
        String serviceImageUrl,
        String optionName,
        int sessions,
        BigDecimal price,
        String optionGroup,
        String gender,
        boolean active
) {}
