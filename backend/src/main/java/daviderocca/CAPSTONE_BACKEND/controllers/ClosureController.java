package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs.ClosureResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs.NewClosureDTO;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.ClosureService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/closures")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class ClosureController {

    private final ClosureService closureService;

    // ---------------------------------- GET (ALL or RANGE) ----------------------------------
    @GetMapping
    public ResponseEntity<List<ClosureResponseDTO>> getClosures(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        if (from != null || to != null) {
            if (from == null || to == null) {
                throw new BadRequestException("Devi specificare sia 'from' che 'to'.");
            }
            log.info("Richiesta chiusure range: from={} to(exclusive)={}", from, to);
            return ResponseEntity.ok(closureService.findClosuresInRange(from, to));
        }

        log.info("Richiesta elenco chiusure (ALL)");
        return ResponseEntity.ok(closureService.findAllClosures());
    }

    // ---------------------------------- POST ----------------------------------
    @PostMapping
    public ResponseEntity<ClosureResponseDTO> createClosure(@Valid @RequestBody NewClosureDTO payload) {
        log.info("Richiesta creazione chiusura per data {}", payload.date());
        ClosureResponseDTO created = closureService.createClosure(payload);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT ----------------------------------
    @PutMapping("/{id}")
    public ResponseEntity<ClosureResponseDTO> updateClosure(
            @PathVariable UUID id,
            @Valid @RequestBody NewClosureDTO payload
    ) {
        log.info("Richiesta aggiornamento chiusura con ID {}", id);
        ClosureResponseDTO updated = closureService.updateClosure(id, payload);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- DELETE ----------------------------------
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClosure(@PathVariable UUID id) {
        log.info("Richiesta eliminazione chiusura con ID {}", id);
        closureService.deleteClosure(id);
        return ResponseEntity.noContent().build();
    }
}