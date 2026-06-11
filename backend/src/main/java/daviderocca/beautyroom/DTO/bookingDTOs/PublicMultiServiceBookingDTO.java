package daviderocca.beautyroom.DTO.bookingDTOs;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
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

        // 08.4: a promo booking sends no catalog services (services come from the promo);
        // non-promo bookings are validated in code (BookingCheckoutController.createSessionMulti).
        List<UUID> serviceIds,

        @NotNull(message = "Durata totale obbligatoria")
        Integer totalDurationMinutes,

        // 08.4: when present, this is a promotion booking — services come from the promo,
        // not from serviceIds (which may be empty). Mutually exclusive with serviceIds in practice.
        UUID promotionId,

        // Fix 3 (mixed cart): products the customer is buying alongside the services. Optional —
        // null/empty for service-only or promo carts. No price/paid from the client; the server
        // resolves both from the Product entity. Added as the LAST field (Jackson binds by name).
        List<ProductEntryDTO> products
) {}
