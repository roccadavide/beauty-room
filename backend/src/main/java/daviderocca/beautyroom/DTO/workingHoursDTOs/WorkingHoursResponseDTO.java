package daviderocca.beautyroom.DTO.workingHoursDTOs;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

public record WorkingHoursResponseDTO(
        UUID id,
        DayOfWeek dayOfWeek,

        @JsonFormat(pattern = "HH:mm")
        LocalTime morningStart,

        @JsonFormat(pattern = "HH:mm")
        LocalTime morningEnd,

        @JsonFormat(pattern = "HH:mm")
        LocalTime afternoonStart,

        @JsonFormat(pattern = "HH:mm")
        LocalTime afternoonEnd,

        boolean closed
) {}