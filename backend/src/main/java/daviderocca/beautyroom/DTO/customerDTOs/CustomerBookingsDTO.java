package daviderocca.beautyroom.DTO.customerDTOs;

import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCardDTO;

import java.util.List;

/**
 * Rich per-customer booking history. Each row is a full {@link AdminBookingCardDTO} (same
 * assembler the agenda uses), so a row can be handed straight to the agenda edit drawer with
 * no extra fetch — and multi-service / package / promo / product / session data is all present.
 *
 * <ul>
 *   <li>{@code upcoming} — active future appointments (start &ge; today AND status in
 *       PENDING_PAYMENT/CONFIRMED), soonest first. All of them (a customer has very few).</li>
 *   <li>{@code past} — everything else (past dates + terminal states), newest first, PAGINATED.</li>
 *   <li>{@code pastTotal} — total count of the unpaginated "past" set, for "load more".</li>
 * </ul>
 */
public record CustomerBookingsDTO(
        List<AdminBookingCardDTO> upcoming,
        List<AdminBookingCardDTO> past,
        long pastTotal
) {}
