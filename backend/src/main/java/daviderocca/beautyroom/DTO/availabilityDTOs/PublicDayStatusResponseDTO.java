package daviderocca.beautyroom.DTO.availabilityDTOs;

import java.time.LocalDate;
import java.util.List;

/**
 * Risposta pubblica per lo stato dei giorni in un intervallo di date.
 * Usata da GET /api/public/availability/day-status.
 *
 * {@code fullDates} elenca SOLO i giorni APERTI ma completamente prenotati
 * ("Pieno") per la durata richiesta, in ordine crescente. I giorni chiusi
 * (weekday chiuso o chiusura totale) NON compaiono: il frontend li gestisce
 * separatamente via /api/public/closures.
 *
 * È un record wrapper (anziché una lista nuda) per poter aggiungere campi in
 * futuro senza rompere la forma della risposta.
 */
public record PublicDayStatusResponseDTO(
        List<LocalDate> fullDates
) {}
