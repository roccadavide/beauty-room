package daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

public record ClosureResponseDTO(
        UUID id,
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime,
        String reason,
        boolean fullDay,
        LocalDateTime createdAt
) {}