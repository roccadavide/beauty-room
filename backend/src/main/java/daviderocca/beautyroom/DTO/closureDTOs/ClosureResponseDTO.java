package daviderocca.beautyroom.DTO.closureDTOs;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

public record ClosureResponseDTO(
        UUID id,
        LocalDate date,        // legacy alias = startDate
        LocalDate startDate,
        LocalDate endDate,
        LocalTime startTime,
        LocalTime endTime,
        String reason,
        boolean fullDay,
        boolean multiDay,
        LocalDateTime createdAt
) {}
