package daviderocca.beautyroom.personalappointments;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record PersonalAppointmentRequestDTO(

        @NotBlank(message = "Il titolo è obbligatorio")
        @Size(max = 255, message = "Il titolo non può superare i 255 caratteri")
        String title,

        // nullable — free-form notes
        String notes,

        @NotNull(message = "La data è obbligatoria")
        LocalDate appointmentDate,

        @NotNull(message = "L'orario di inizio è obbligatorio")
        LocalTime startTime,

        @NotNull(message = "La durata è obbligatoria")
        @Min(value = 1, message = "La durata deve essere almeno 1 minuto")
        Integer durationMinutes,

        // nullable (multi-staff prompt 03) — absent = caller's own staff row,
        // else the default staff. STAFF may only target themselves (matrix row 10).
        UUID staffId
) {}
