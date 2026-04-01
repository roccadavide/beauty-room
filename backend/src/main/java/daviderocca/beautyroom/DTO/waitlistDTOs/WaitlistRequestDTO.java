package daviderocca.beautyroom.DTO.waitlistDTOs;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record WaitlistRequestDTO(
    UUID serviceId,
    LocalDate requestedDate,
    LocalTime requestedTime,
    String customerName,
    String customerEmail,
    String customerPhone
) {}
