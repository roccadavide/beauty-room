package daviderocca.beautyroom.DTO.closureDTOs;

import java.time.LocalDate;

/**
 * DTO pubblico per chiusure esposte a utenti non autenticati.
 *
 * Due varianti:
 *  - Chiusura specifica:  recurring=false, date/reason/fullDay valorizzati, dayOfWeek=null
 *  - Chiusura ricorrente: recurring=true,  dayOfWeek valorizzato, date/reason=null, fullDay=true
 */
public record PublicClosureDTO(
        LocalDate date,
        String reason,
        boolean fullDay,
        String dayOfWeek,
        boolean recurring
) {}
