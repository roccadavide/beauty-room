package daviderocca.CAPSTONE_BACKEND.DTO;

import jakarta.validation.constraints.*;
import java.time.DayOfWeek;
import java.time.LocalTime;

public record NewWorkingHoursDTO(
        @NotNull(message = "Il giorno della settimana è obbligatorio")
        DayOfWeek dayOfWeek,
        @NotNull(message = "Il flag di chiusura è obbligatorio")
        Boolean closed,
        LocalTime morningStart,
        LocalTime morningEnd,
        LocalTime afternoonStart,
        LocalTime afternoonEnd
) {}