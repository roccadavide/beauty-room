package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.promotionDTOs.NewPromotionDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.promotionDTOs.PromotionResponseDTO;
import daviderocca.CAPSTONE_BACKEND.enums.PromotionScope;
import daviderocca.CAPSTONE_BACKEND.services.PromotionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/promotions")
@RequiredArgsConstructor
@Slf4j
public class PromotionController {

    private final PromotionService promotionService;

    // ---------------------------------- GET ----------------------------------
    @GetMapping("/active")
    public ResponseEntity<List<PromotionResponseDTO>> getActivePromotions() {
        log.info("Richiesta elenco promozioni attive");
        List<PromotionResponseDTO> activePromos = promotionService.findActivePromotions();
        return ResponseEntity.ok(activePromos);
    }

    @GetMapping
    public ResponseEntity<Page<PromotionResponseDTO>> getAllPromotions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "priority") String sort
    ) {
        log.info("Richiesta elenco promozioni [page={}, size={}, sort={}]", page, size, sort);
        Page<PromotionResponseDTO> promotions = promotionService.findAllPromotions(page, size, sort);
        return ResponseEntity.ok(promotions);
    }

    @GetMapping("/scope/{scope}")
    public ResponseEntity<List<PromotionResponseDTO>> getPromotionsByScope(@PathVariable PromotionScope scope) {
        log.info("Richiesta promozioni per scope: {}", scope);
        List<PromotionResponseDTO> results = promotionService.findByScope(scope);
        return ResponseEntity.ok(results);
    }

    @GetMapping("/{promotionId}")
    public ResponseEntity<PromotionResponseDTO> getPromotionById(@PathVariable UUID promotionId) {
        log.info("Richiesta dettaglio promozione {}", promotionId);
        return ResponseEntity.ok(promotionService.findByIdAndConvert(promotionId));
    }

    // ---------------------------------- POST ----------------------------------
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PromotionResponseDTO> createPromotion(
            @Valid @RequestPart("data") NewPromotionDTO payload,
            @RequestPart(value = "bannerImage", required = false) MultipartFile bannerImage,
            @RequestPart(value = "cardImage", required = false) MultipartFile cardImage
    ) {
        log.info("Creazione promozione '{}'", payload.title());
        PromotionResponseDTO created = promotionService.createPromotion(payload, bannerImage, cardImage);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT --------------------------------
    @PutMapping(value = "/{promotionId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PromotionResponseDTO> updatePromotion(
            @PathVariable UUID promotionId,
            @Valid @RequestPart("data") NewPromotionDTO payload,
            @RequestPart(value = "bannerImage", required = false) MultipartFile bannerImage,
            @RequestPart(value = "cardImage", required = false) MultipartFile cardImage
    ) {
        log.info("Aggiornamento promozione {}", promotionId);
        PromotionResponseDTO updated = promotionService.updatePromotion(promotionId, payload, bannerImage, cardImage);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- DELETE ----------------------------------
    @DeleteMapping("/{promotionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deletePromotion(@PathVariable UUID promotionId) {
        log.info("Eliminazione promozione {}", promotionId);
        promotionService.deletePromotion(promotionId);
        return ResponseEntity.noContent().build();
    }
}