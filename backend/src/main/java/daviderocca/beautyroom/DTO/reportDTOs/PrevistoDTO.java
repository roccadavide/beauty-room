package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

/**
 * The "Previsto" (pipeline) ledger — money booked or owed but NOT yet collected.
 * Never added to Incassato. {@code pipelineTotal} = expected value of future
 * CONFIRMED, uncollected bookings; {@code arretratiTotal} = completed-but-unpaid
 * money owed across all clients; {@code upcomingCount} = number of those future
 * bookings.
 */
public record PrevistoDTO(
        BigDecimal pipelineTotal,
        BigDecimal arretratiTotal,
        long upcomingCount
) {}
