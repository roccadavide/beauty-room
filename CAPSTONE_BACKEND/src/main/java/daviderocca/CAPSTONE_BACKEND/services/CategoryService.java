package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.CategoryResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewCategoryDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Category;
import daviderocca.CAPSTONE_BACKEND.exceptions.DuplicateResourceException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.CategoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Slf4j
public class CategoryService {

    @Autowired
    private CategoryRepository categoryRepository;

    // ---------------------------------- FIND METHODS ----------------------------------
    @Transactional(readOnly = true)
    public Page<CategoryResponseDTO> findAllCategories(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<Category> page = categoryRepository.findAll(pageable);
        return page.map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    public Category findCategoryById(UUID categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException(categoryId));
    }

    @Transactional(readOnly = true)
    public CategoryResponseDTO findCategoryByIdAndConvert(UUID categoryId) {
        Category found = findCategoryById(categoryId);
        return convertToDTO(found);
    }

    // ---------------------------------- CREATE ----------------------------------
    @Transactional
    public CategoryResponseDTO saveCategory(NewCategoryDTO payload) {
        // Controllo chiave duplicata
        categoryRepository.findByCategoryKey(payload.categoryKey())
                .ifPresent(c -> {
                    throw new DuplicateResourceException("Esiste già una categoria con la chiave '" + payload.categoryKey() + "'");
                });

        // Controllo label duplicata
        categoryRepository.findByLabel(payload.label())
                .ifPresent(c -> {
                    throw new DuplicateResourceException("Esiste già una categoria con l'etichetta '" + payload.label() + "'");
                });

        Category newCategory = new Category(payload.categoryKey(), payload.label());
        Category saved = categoryRepository.save(newCategory);

        log.info("✅ Categoria '{}' (ID: {}) creata correttamente.", saved.getLabel(), saved.getCategoryId());
        return convertToDTO(saved);
    }

    // ---------------------------------- UPDATE ----------------------------------
    @Transactional
    public CategoryResponseDTO updateCategory(UUID categoryId, NewCategoryDTO payload) {
        Category found = findCategoryById(categoryId);

        // Verifica duplicati su key e label (escludendo sé stessa)
        categoryRepository.findByCategoryKey(payload.categoryKey())
                .filter(c -> !c.getCategoryId().equals(categoryId))
                .ifPresent(c -> {
                    throw new DuplicateResourceException("Esiste già una categoria con la chiave '" + payload.categoryKey() + "'");
                });

        categoryRepository.findByLabel(payload.label())
                .filter(c -> !c.getCategoryId().equals(categoryId))
                .ifPresent(c -> {
                    throw new DuplicateResourceException("Esiste già una categoria con l'etichetta '" + payload.label() + "'");
                });

        found.setCategoryKey(payload.categoryKey());
        found.setLabel(payload.label());

        Category updated = categoryRepository.save(found);
        log.info("✏️ Categoria '{}' (ID: {}) aggiornata correttamente.", updated.getLabel(), updated.getCategoryId());

        return convertToDTO(updated);
    }

    // ---------------------------------- DELETE ----------------------------------
    @Transactional
    public void deleteCategory(UUID categoryId) {
        Category found = findCategoryById(categoryId);
        categoryRepository.delete(found);
        log.info("🗑️ Categoria '{}' (ID: {}) eliminata correttamente.", found.getLabel(), found.getCategoryId());
    }

    // ---------------------------------- CONVERTER ----------------------------------
    private CategoryResponseDTO convertToDTO(Category category) {
        return new CategoryResponseDTO(
                category.getCategoryId(),
                category.getCategoryKey(),
                category.getLabel()
        );
    }
}