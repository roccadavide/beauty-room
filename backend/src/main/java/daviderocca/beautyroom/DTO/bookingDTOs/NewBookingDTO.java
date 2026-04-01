package daviderocca.beautyroom.DTO.bookingDTOs;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record NewBookingDTO(
        @NotEmpty(message = "Il nome del cliente non può essere vuoto")
        String customerName,

        @Email(message = "Email non valida")
        @NotEmpty(message = "L'email del cliente non può essere vuota")
        String customerEmail,

        @NotEmpty(message = "Il numero di telefono non può essere vuoto")
        @Pattern(regexp = "^[+0-9\\s-]{7,20}$", message = "Numero di telefono non valido")
        String customerPhone,

        @NotNull(message = "La data e ora di inizio non può essere nulla")
        LocalDateTime startTime,

        String notes,

        @NotNull(message = "ID del servizio obbligatorio")
        UUID serviceId,

        UUID serviceOptionId,
        UUID packageCreditId,
        boolean consentLaser,
        boolean consentPmu,
        BigDecimal promoPrice,
        UUID promotionId,
        Integer paddingMinutes
) {}