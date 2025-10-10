package daviderocca.CAPSTONE_BACKEND.DTO;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

public record WorkingHoursResponseDTO(
        UUID id,
        DayOfWeek dayOfWeek,
        LocalTime morningStart,
        LocalTime morningEnd,
        LocalTime afternoonStart,
        LocalTime afternoonEnd,
        boolean closed
) {}