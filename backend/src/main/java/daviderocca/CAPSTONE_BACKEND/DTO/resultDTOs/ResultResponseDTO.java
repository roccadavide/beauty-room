package daviderocca.CAPSTONE_BACKEND.DTO.resultDTOs;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record ResultResponseDTO(
        UUID resultId,
        String title,
        String shortDescription,
        String description,
        List<String> images,
        UUID categoryId,
        LocalDateTime createdAt
) {}