package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs.ClosureResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs.NewClosureDTO;
import daviderocca.CAPSTONE_BACKEND.services.ClosureService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/closures")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class ClosureController {

    private final ClosureService closureService;

    // ---------------------------------- GET ----------------------------------
    @GetMapping
    public ResponseEntity<List<ClosureResponseDTO>> getAllClosures() {
        log.info("Richiesta elenco chiusure");
        List<ClosureResponseDTO> closures = closureService.findAllClosures();
        return ResponseEntity.ok(closures);
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