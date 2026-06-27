package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;
import java.util.List;

/**
 * The "Previsto" (pipeline) ledger — money booked or owed but NOT yet collected.
 * Never added to Incassato.
 *
 * <p>{@code pipelineTotal} = expected value of future CONFIRMED, uncollected bookings;
 * {@code arretratiTotal} = completed-but-unpaid money owed across ALL clients;
 * {@code upcomingCount} = number of those future bookings.
 *
 * <p>Read-only detail over the same pipeline/arrears surface: {@code byType} splits the
 * pipeline into the four report buckets (the pipeline surface is the treatments leg, so
 * trattamenti carries it and sum(byType) == pipelineTotal); {@code timeline} is the next
 * 8 ISO weeks of pipeline; {@code upcoming} the soonest appointments; {@code arretrati}
 * the per-debtor breakdown (capped at 15 — the full owed sum stays in {@code
 * arretratiTotal}).
 */
public record PrevistoDTO(
        BigDecimal pipelineTotal,
        BigDecimal arretratiTotal,
        long upcomingCount,
        ByTypeDTO byType,
        List<TimelineWeekDTO> timeline,
        List<UpcomingApptDTO> upcoming,
        List<ArretratoDebtorDTO> arretrati
) {}
