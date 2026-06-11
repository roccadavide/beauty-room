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
        List<ProductEntryDTO> products,

        // Fix 9 (consent persistence): the laser/PMU informed-consent acknowledgment the customer
        // ticked in the cart flow. The FE already sends these; previously dropped (no field here).
        // Appended last (Jackson binds by name). Stored only — no UI surfacing in this pass.
        boolean consentLaser,
        boolean consentPmu,

        // Fix 11 (option pricing): per-service selected option ids, INDEX-ALIGNED to serviceIds
        // (built from the same FE .map(), so position i is the option for serviceIds[i]; null where
        // the service has no option). The server prices each line from option.getPrice() when present
        // — never from a client-sent price. Null/short list ⇒ treat every service as option-less.
        // Appended last (Jackson binds by name); positional callers must add it last too.
        List<UUID> serviceOptionIds
) {}
