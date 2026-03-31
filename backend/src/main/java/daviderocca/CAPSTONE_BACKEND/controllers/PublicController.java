package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs.PublicNextSlotDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs.ClosureResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs.PublicClosureDTO;
import daviderocca.CAPSTONE_BACKEND.services.AvailabilityService;
import daviderocca.CAPSTONE_BACKEND.services.ClosureService;
import daviderocca.CAPSTONE_BACKEND.services.WorkingHoursService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Controller pubblico (nessuna autenticazione richiesta).
 * Espone informazioni di disponibilità e chiusure necessarie al frontend
 * per il flusso di prenotazione utente.
 */
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
@Slf4j
public class PublicController {

    private final ClosureService closureService;
    private final WorkingHoursService workingHoursService;
    private final AvailabilityService availabilityService;

    // ==========================================================================
    // ENDPOINT PUBBLICO CHIUSURE
    // GET /api/public/closures
    // ==========================================================================

    /**
     * Restituisce tutte le chiusure visibili pubblicamente:
     *  - Chiusure su data specifica (es. festività, ferie)
     *  - Giorni della settimana con closed=true negli orari di lavoro (es. domenica)
     */
    @GetMapping("/closures")
    public ResponseEntity<List<PublicClosureDTO>> getPublicClosures() {
        log.info("PUBLIC | richiesta chiusure");

        List<PublicClosureDTO> result = new ArrayList<>();

        // 1) Chiusure specifiche per data
        List<ClosureResponseDTO> specificClosures = closureService.findAllClosures();
        for (ClosureResponseDTO c : specificClosures) {
            result.add(new PublicClosureDTO(
                    c.date(),
                    c.reason(),
                    c.fullDay(),
                    null,
                    false
            ));
        }

        // 2) Giorni della settimana configurati come chiusi (ricorrenti)
        workingHoursService.findAll().stream()
                .filter(wh -> wh.closed())
                .forEach(wh -> result.add(new PublicClosureDTO(
                        null,
                        null,
                        true,
                        wh.dayOfWeek().name(),
                        true
                )));

        return ResponseEntity.ok(result);
    }

    // ==========================================================================
    // ENDPOINT PUBBLICO NEXT AVAILABLE SLOT
    // GET /api/public/slots/next?serviceId={uuid}&fromDate={yyyy-MM-dd}
    // ==========================================================================

    /**
     * Restituisce il prossimo slot disponibile per il servizio specificato,
     * cercando a partire da fromDate (default: oggi) per un massimo di 60 giorni.
     *
     * Risposta 200: { "date": "2025-04-15", "startTime": "10:00", "endTime": "11:00" }
     * Risposta 404: nessuno slot trovato nei prossimi 60 giorni
     */
    @GetMapping("/slots/next")
    public ResponseEntity<PublicNextSlotDTO> getNextAvailableSlot(
            @RequestParam UUID serviceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) String fromTime
    ) {
        log.info("PUBLIC | next slot | serviceId={} fromDate={} fromTime={}", serviceId, fromDate, fromTime);

        Optional<PublicNextSlotDTO> result = availabilityService.findNextAvailableSlotForService(serviceId, fromDate, fromTime);

        return result
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
