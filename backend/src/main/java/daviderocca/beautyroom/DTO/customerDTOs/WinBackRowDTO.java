package daviderocca.beautyroom.DTO.customerDTOs;

import java.time.LocalDate;
import java.util.UUID;

/**
 * A lapsed customer worth winning back: most recent COMPLETED visit is older than the win-back
 * threshold (60 days) AND they have no active future booking. Keyed on the customer FK (always
 * clickable). {@code daysSince} = whole days from {@code lastVisit} to today.
 */
public record WinBackRowDTO(
        UUID customerId,
        String name,
        String phone,
        LocalDate lastVisit,
        long daysSince
) {}
