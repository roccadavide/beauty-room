package daviderocca.beautyroom.DTO.closureDTOs;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Closure creation / update payload.
 *
 * Date semantics:
 *  - The canonical fields are {@code startDate} + {@code endDate}.
 *  - {@code date} is kept as a legacy alias: if {@code startDate} is null but
 *    {@code date} is set, it is used as both start and end. This lets older
 *    clients keep posting single-date payloads without breaking.
 *  - If {@code endDate} is null, it is treated as equal to {@code startDate}.
 *
 * Staff semantics (multi-staff prompt 03, decision #7):
 *  - {@code staffId} null = salon-wide closure (today's behavior);
 *  - non-null = that staff member's absence.
 */
public record NewClosureDTO(
        LocalDate date,
        LocalDate startDate,
        LocalDate endDate,
        LocalTime startTime,
        LocalTime endTime,
        @NotBlank(message = "La motivazione è obbligatoria")
        @Size(max = 150, message = "La motivazione può essere lunga al massimo 150 caratteri")
        String reason,
        UUID staffId
) {
    public LocalDate effectiveStartDate() {
        return startDate != null ? startDate : date;
    }

    public LocalDate effectiveEndDate() {
        if (endDate != null) return endDate;
        return effectiveStartDate();
    }
}
