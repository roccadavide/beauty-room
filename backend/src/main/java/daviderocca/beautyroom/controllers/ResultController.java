package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.resultDTOs.NewResultDTO;
import daviderocca.beautyroom.DTO.resultDTOs.ResultResponseDTO;
import daviderocca.beautyroom.services.ResultService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/results")
@RequiredArgsConstructor
@Slf4j
public class ResultController {

    private final ResultService resultService;

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
            @RequestPart(value = "images", required = false) List<MultipartFile> images
    ) {
        log.info("Richiesta creazione nuovo risultato '{}'", payload.title());
        ResultResponseDTO created = resultService.saveResult(payload, images);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{resultId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResultResponseDTO> updateResult(
            @PathVariable UUID resultId,
            @Valid @RequestPart("data") NewResultDTO payload,
            @RequestPart(value = "images", required = false) List<MultipartFile> images
    ) {
        log.info("Richiesta aggiornamento risultato {}", resultId);
        ResultResponseDTO updated = resultService.updateResult(resultId, payload, images);
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

    @PatchMapping("/{resultId}/featured")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResultResponseDTO> setFeatured(
            @PathVariable UUID resultId,
            @RequestParam boolean value) {
        return ResponseEntity.ok(resultService.setFeatured(resultId, value));
    }

    @PatchMapping("/{resultId}/toggle-active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> toggleActive(@PathVariable UUID resultId) {
        resultService.toggleActive(resultId);
        return ResponseEntity.ok().build();
    }
}