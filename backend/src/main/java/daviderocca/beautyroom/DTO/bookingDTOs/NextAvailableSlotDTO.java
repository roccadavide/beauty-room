package daviderocca.beautyroom.DTO.bookingDTOs;

import java.time.LocalDate;
import java.time.LocalTime;

public record NextAvailableSlotDTO(
        LocalDate date,
        LocalTime slotStart,
        LocalTime slotEnd,
        int availableMin
) {}

