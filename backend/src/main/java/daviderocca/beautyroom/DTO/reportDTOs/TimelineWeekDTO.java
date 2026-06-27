package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One ISO week (Monday start) of the upcoming-revenue pipeline. {@code amount} is the
 * expected (not-yet-collected) value of the future CONFIRMED bookings that start in this
 * week; {@code count} is how many. Zero-amount weeks are emitted too, so a dip in future
 * income is visible at a glance.
 */
public record TimelineWeekDTO(
        LocalDate weekStart,
        BigDecimal amount,
        long count
) {}
