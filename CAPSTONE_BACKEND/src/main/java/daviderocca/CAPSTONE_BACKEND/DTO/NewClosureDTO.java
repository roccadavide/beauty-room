package daviderocca.CAPSTONE_BACKEND.DTO;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;

public record NewClosureDTO(
        @NotNull(message = "La data di chiusura è obbligatoria!")
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime,
        @Size(max = 255)
        String reason
) {}