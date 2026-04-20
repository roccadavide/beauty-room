package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.productDTOs.ProductOptionRequest;
import daviderocca.beautyroom.DTO.productDTOs.ProductOptionResponse;
import daviderocca.beautyroom.services.ProductOptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Slf4j
public class ProductOptionController {

    private final ProductOptionService productOptionService;

    @PostMapping("/products/{productId}/options")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductOptionResponse> createOption(
            @PathVariable UUID productId,
            @Valid @RequestBody ProductOptionRequest req) {
        log.info("Creazione opzione per prodotto {}", productId);
        return ResponseEntity.status(201).body(productOptionService.createOption(productId, req));
    }

    @PutMapping("/product-options/{optionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductOptionResponse> updateOption(
            @PathVariable UUID optionId,
            @Valid @RequestBody ProductOptionRequest req) {
        log.info("Aggiornamento opzione {}", optionId);
        return ResponseEntity.ok(productOptionService.updateOption(optionId, req));
    }

    @DeleteMapping("/product-options/{optionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteOption(@PathVariable UUID optionId) {
        log.info("Eliminazione opzione {}", optionId);
        productOptionService.deleteOption(optionId);
        return ResponseEntity.noContent().build();
    }
}
