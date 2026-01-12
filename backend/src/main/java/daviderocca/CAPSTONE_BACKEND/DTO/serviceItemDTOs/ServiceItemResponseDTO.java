package daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ServiceItemResponseDTO(
        UUID serviceId,
        String title,
        int durationMin,
        BigDecimal price,
        String shortDescription,
        String description,
        List<String> images,
        UUID categoryId,
        List<ServiceOptionResponseDTO> options
) {}
