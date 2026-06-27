package daviderocca.beautyroom.DTO.reportDTOs;

import java.util.List;

/**
 * Operational timing insight for the report: when the chair is busy and earning.
 *
 * <p>{@code heatmap} is the sparse weekday x hour map of collected treatment revenue —
 * the SAME rows that feed {@code incassato.byType.trattamenti}, bucketed by the
 * appointment's start time. By construction {@code sum(heatmap.amount)} reconciles to
 * {@code incassato.byType.trattamenti} for the same range (products and packages have no
 * single appointment hour, so they are not in the map).
 */
public record TimingDTO(
        List<HeatmapCellDTO> heatmap
) {}
