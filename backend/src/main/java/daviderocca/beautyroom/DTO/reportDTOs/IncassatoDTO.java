package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;
import java.util.List;

/**
 * The "Incassato" (collected) ledger — cash-basis, reconciles to Stripe + SumUp +
 * cash. {@code total} equals the sum of {@code byType} legs (net of {@code
 * refundsTotal}, which is already subtracted from trattamenti). {@code byChannel}
 * sums to the same total. {@code appointmentsCount} = collected treatment
 * appointments; {@code averageTicket} = total / appointmentsCount.
 */
public record IncassatoDTO(
        BigDecimal total,
        ByTypeDTO byType,
        ByChannelDTO byChannel,
        BigDecimal refundsTotal,
        BigDecimal averageTicket,
        long appointmentsCount,
        List<MonthlyRevenueDTO> monthly
) {}
