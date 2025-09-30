package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.CategoryResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewCategoryDTO;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.CategoryService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/categories")
@Slf4j
public class CategoryController {

    @Autowired
    private CategoryService categoryService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public Page<CategoryResponseDTO> getAllCategories(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "label") String sort
    ) {
        log.info("Richiesta elenco categorie - pagina: {}, size: {}, sort: {}", page, size, sort);
        return categoryService.findAllCategories(page, size, sort);
    }

    @GetMapping("/{categoryId}")
    @ResponseStatus(HttpStatus.OK)
    public CategoryResponseDTO getCategoryById(@PathVariable UUID categoryId) {
        log.info("Richiesta dettaglio categoria {}", categoryId);
        return categoryService.findCategoryByIdAndConvert(categoryId);
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public CategoryResponseDTO createCategory(@Validated @RequestBody NewCategoryDTO payload, BindingResult bindingResult) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta creazione categoria {}", payload.categoryKey());
        return categoryService.saveCategory(payload);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{categoryId}")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('ADMIN')")
    public CategoryResponseDTO updateCategory(
            @PathVariable UUID categoryId,
            @Validated @RequestBody NewCategoryDTO payload,
            BindingResult bindingResult
    ) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta aggiornamento categoria {}", categoryId);
        return categoryService.findCategoryByIdAndUpdate(categoryId, payload);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{categoryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteCategory(@PathVariable UUID categoryId) {
        log.info("Richiesta eliminazione categoria {}", categoryId);
        categoryService.findCategoryByIdAndDelete(categoryId);
    }
}
