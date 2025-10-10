package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.NewResultDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.ResultResponseDTO;
import daviderocca.CAPSTONE_BACKEND.services.ResultService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import java.util.UUID;

@RestController
@RequestMapping("/results")
@Slf4j
public class ResultController {

    @Autowired
    private ResultService resultService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping
    public ResponseEntity<Page<ResultResponseDTO>> getAllResults(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sort
    ) {
        log.info("Richiesta elenco risultati [page={}, size={}, sort={}]", page, size, sort);
        Page<ResultResponseDTO> results = resultService.findAllResults(page, size, sort);
        return ResponseEntity.ok(results);
    }

    @GetMapping("/{resultId}")
    public ResponseEntity<ResultResponseDTO> getResultById(@PathVariable UUID resultId) {
        log.info("Richiesta dettaglio risultato {}", resultId);
        return ResponseEntity.ok(resultService.findResultByIdAndConvert(resultId));
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResultResponseDTO> createResult(
            @Valid @RequestPart("data") NewResultDTO payload,
            @RequestPart(value = "image", required = false) MultipartFile image
    ) {
        log.info("Richiesta creazione nuovo risultato '{}'", payload.title());
        ResultResponseDTO created = resultService.saveResult(payload, image);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{resultId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResultResponseDTO> updateResult(
            @PathVariable UUID resultId,
            @Valid @RequestPart("data") NewResultDTO payload,
            @RequestPart(value = "image", required = false) MultipartFile image
    ) {
        log.info("Richiesta aggiornamento risultato {}", resultId);
        ResultResponseDTO updated = resultService.updateResult(resultId, payload, image);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{resultId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteResult(@PathVariable UUID resultId) {
        log.info("Richiesta eliminazione risultato {}", resultId);
        resultService.deleteResult(resultId);
        return ResponseEntity.noContent().build();
    }
}