package daviderocca.beautyroom.DTO.reportDTOs;

import java.util.List;

/**
 * Two-ledger admin report (cash-basis). {@code incassato} = money actually collected
 * in the period; {@code previsto} = booked/owed but not yet collected; {@code
 * comparison} = period-over-period deltas. {@code flaggedSkipped} counts records that
 * could not be valued (e.g. an online package credit with a null serviceOption) so
 * data issues are visible rather than silently dropped. {@code timing} carries the
 * weekday x hour earnings map (read-only operational insight over the trattamenti leg).
 */
public record ReportResponseDTO(
        ReportRangeDTO range,
        IncassatoDTO incassato,
        PrevistoDTO previsto,
        ComparisonDTO comparison,
        List<TopServiceDTO> topServices,
        List<TopProductDTO> topProducts,
        List<TopClientReportDTO> topClients,
        long newClientsCount,
        long cancelledCount,
        long flaggedSkipped,
        TimingDTO timing
) {}
