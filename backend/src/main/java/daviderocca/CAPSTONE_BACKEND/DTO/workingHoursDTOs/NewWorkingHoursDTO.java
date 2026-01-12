package daviderocca.CAPSTONE_BACKEND.DTO.workingHoursDTOs;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.*;
import java.time.DayOfWeek;
import java.time.LocalTime;

public record NewWorkingHoursDTO(
        @NotNull(message = "Il giorno della settimana è obbligatorio")
        DayOfWeek dayOfWeek,

        @NotNull(message = "Il flag di chiusura è obbligatorio")
        Boolean closed,

        @JsonFormat(pattern = "HH:mm")
        LocalTime morningStart,

        @JsonFormat(pattern = "HH:mm")
        LocalTime morningEnd,

        @JsonFormat(pattern = "HH:mm")
        LocalTime afternoonStart,

        @JsonFormat(pattern = "HH:mm")
        LocalTime afternoonEnd
) {}