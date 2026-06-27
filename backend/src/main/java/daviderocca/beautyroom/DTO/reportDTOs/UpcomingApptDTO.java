package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single upcoming (future, not-yet-collected) appointment in the pipeline preview:
 * its date, the client, a display service name and the expected amount.
 */
public record UpcomingApptDTO(
        LocalDate date,
        String clientName,
        String serviceName,
        BigDecimal amount
) {}
