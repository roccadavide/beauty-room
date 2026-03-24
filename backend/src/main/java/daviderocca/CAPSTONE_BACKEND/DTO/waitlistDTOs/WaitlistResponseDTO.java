package daviderocca.CAPSTONE_BACKEND.DTO.waitlistDTOs;

import daviderocca.CAPSTONE_BACKEND.enums.WaitlistStatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record WaitlistResponseDTO(
    UUID id,
    LocalDate requestedDate,
    LocalTime requestedTime,
    String serviceName,
    WaitlistStatus status,
    int positionInQueue
) {}
