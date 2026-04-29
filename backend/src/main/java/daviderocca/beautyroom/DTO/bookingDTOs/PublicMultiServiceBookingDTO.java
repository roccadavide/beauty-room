package daviderocca.beautyroom.DTO.bookingDTOs;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Request DTO for the public multi-service booking checkout endpoint.
 * No pre-hold booking is created; the booking is finalised by the Stripe webhook.
 */
public record PublicMultiServiceBookingDTO(

        @NotBlank(message = "Nome cliente obbligatorio")
        @Size(max = 100)
        String customerName,

        @NotBlank(message = "Email cliente obbligatoria")
        @Email(message = "Email non valida")
        @Size(max = 150)
        String customerEmail,

        @NotBlank(message = "Telefono cliente obbligatorio")
        @Size(max = 20)
        String customerPhone,

        @Size(max = 500)
        String notes,

        @NotNull(message = "Data obbligatoria")
        LocalDate date,

        @NotNull(message = "Ora di inizio obbligatoria")
        LocalTime startTime,

        @NotEmpty(message = "Seleziona almeno un servizio")
        List<UUID> serviceIds,

        @NotNull(message = "Durata totale obbligatoria")
        Integer totalDurationMinutes
) {}
