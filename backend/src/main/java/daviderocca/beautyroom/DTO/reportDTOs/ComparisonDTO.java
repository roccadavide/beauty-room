package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

/**
 * Period-over-period comparison, computed server-side by running the same cash-basis
 * model over the compare window. {@code incassatoTotalDeltaPct} is 0 when the compare
 * total is 0 (avoids divide-by-zero). All deltas are main − compare.
 */
public record ComparisonDTO(
        BigDecimal incassatoTotalDelta,
        BigDecimal incassatoTotalDeltaPct,
        ByTypeDTO byTypeDelta
) {}
