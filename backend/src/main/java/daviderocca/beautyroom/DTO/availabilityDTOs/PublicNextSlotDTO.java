package daviderocca.beautyroom.DTO.availabilityDTOs;

import java.time.LocalDate;

/**
 * Risposta pubblica per il prossimo slot disponibile.
 * Usata da GET /api/public/slots/next
 */
public record PublicNextSlotDTO(
        LocalDate date,
        String startTime,
        String endTime
) {}
