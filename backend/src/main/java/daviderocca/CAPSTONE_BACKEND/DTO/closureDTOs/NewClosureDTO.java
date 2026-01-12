package daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;

public record NewClosureDTO(
        @NotNull(message = "La data di chiusura è obbligatoria!")
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime,
        @NotBlank(message = "La motivazione è obbligatoria")
        @Size(max = 150, message = "La motivazione può essere lunga al massimo 150 caratteri")
        String reason
) {}