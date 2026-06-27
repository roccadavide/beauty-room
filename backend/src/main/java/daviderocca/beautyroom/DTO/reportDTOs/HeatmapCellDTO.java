package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

/**
 * One non-empty cell of the "quando incassi di più" weekday x hour earnings map.
 *
 * <p>{@code weekday} is 1 = Monday ... 7 = Sunday; {@code hour} is 0-23 (the appointment
 * start hour, business-local wall-clock). {@code amount} is the effective collected
 * treatment revenue in that slot (refunds netted) and {@code count} the number of
 * collected appointments. Only cells with at least one collected appointment are emitted
 * — the frontend reconstructs the full grid from the sparse list.
 */
public record HeatmapCellDTO(
        int weekday,
        int hour,
        BigDecimal amount,
        long count
) {}
