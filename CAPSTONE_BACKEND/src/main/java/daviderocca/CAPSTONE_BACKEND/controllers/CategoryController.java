package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.CategoryResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewCategoryDTO;
import daviderocca.CAPSTONE_BACKEND.services.CategoryService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/categories")
@Slf4j
public class CategoryController {

    @Autowired
    private CategoryService categoryService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping
    public ResponseEntity<Page<CategoryResponseDTO>> getAllCategories(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "label") String sort
    ) {
        log.info("Richiesta elenco categorie [page={}, size={}, sort={}]", page, size, sort);
        return ResponseEntity.ok(categoryService.findAllCategories(page, size, sort));
    }

    @GetMapping("/{categoryId}")
    public ResponseEntity<CategoryResponseDTO> getCategoryById(@PathVariable UUID categoryId) {
        log.info("Richiesta dettaglio categoria {}", categoryId);
        return ResponseEntity.ok(categoryService.findCategoryByIdAndConvert(categoryId));
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CategoryResponseDTO> createCategory(
            @Valid @RequestBody NewCategoryDTO payload
    ) {
        log.info("Richiesta creazione categoria con chiave '{}'", payload.categoryKey());
        CategoryResponseDTO created = categoryService.saveCategory(payload);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{categoryId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CategoryResponseDTO> updateCategory(
            @PathVariable UUID categoryId,
            @Valid @RequestBody NewCategoryDTO payload
    ) {
        log.info("Richiesta aggiornamento categoria {}", categoryId);
        CategoryResponseDTO updated = categoryService.updateCategory(categoryId, payload);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{categoryId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteCategory(@PathVariable UUID categoryId) {
        log.info("Richiesta eliminazione categoria {}", categoryId);
        categoryService.deleteCategory(categoryId);
        return ResponseEntity.noContent().build();
    }
}