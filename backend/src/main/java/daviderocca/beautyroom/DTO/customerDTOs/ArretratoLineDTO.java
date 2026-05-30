package daviderocca.beautyroom.DTO.customerDTOs;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One unsettled line on a past COMPLETED booking (derived, no table).
 * price may be null when the source line has no resolvable price.
 */
public record ArretratoLineDTO(
        UUID bookingId,
        LocalDateTime occurredAt,
        String label,
        BigDecimal price
) {}
