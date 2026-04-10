package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.productDTOs.NewProductDTO;
import daviderocca.beautyroom.DTO.productDTOs.ProductResponseDTO;
import daviderocca.beautyroom.services.ProductService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
@Slf4j
public class ProductController {

    private final ProductService productService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping
    public ResponseEntity<Page<ProductResponseDTO>> getAllProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "name") String sort
    ) {
        log.info("Richiesta elenco prodotti [page={}, size={}, sort={}]", page, size, sort);
        return ResponseEntity.ok(productService.findAllProducts(page, size, sort));
    }

    @GetMapping("/{productId}")
    public ResponseEntity<ProductResponseDTO> getProductById(@PathVariable UUID productId) {
        log.info("Richiesta dettaglio prodotto {}", productId);
        return ResponseEntity.ok(productService.findProductByIdAndConvert(productId));
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductResponseDTO> createProduct(
            @Valid @RequestPart("data") NewProductDTO payload,
            @RequestPart(value = "images", required = false) List<MultipartFile> images
    ) {
        log.info("Richiesta creazione nuovo prodotto '{}'", payload.name());
        ProductResponseDTO created = productService.saveProduct(payload, images);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{productId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductResponseDTO> updateProduct(
            @PathVariable UUID productId,
            @Valid @RequestPart("data") NewProductDTO payload,
            @RequestPart(value = "images", required = false) List<MultipartFile> images
    ) {
        log.info("Richiesta aggiornamento prodotto {}", productId);
        ProductResponseDTO updated = productService.updateProduct(productId, payload, images);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{productId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteProduct(@PathVariable UUID productId) {
        log.info("Richiesta eliminazione prodotto {}", productId);
        productService.deleteProduct(productId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{productId}/toggle-active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> toggleActive(@PathVariable UUID productId) {
        productService.toggleActive(productId);
        return ResponseEntity.ok().build();
    }
}