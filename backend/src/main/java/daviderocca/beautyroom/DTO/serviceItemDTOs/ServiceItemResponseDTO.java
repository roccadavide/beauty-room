package daviderocca.beautyroom.DTO.serviceItemDTOs;

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
        String categoryKey,
        boolean active,
        List<ServiceOptionResponseDTO> options,
        List<String> badges,
        boolean featured,
        boolean consentRequired
) {}
