package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.CategoryResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewCategoryDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Category;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.CategoryRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@Slf4j
public class CategoryService {

    @Autowired
    private CategoryRepository categoryRepository;

    public Page<CategoryResponseDTO> findAllCategories(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<Category> page = this.categoryRepository.findAll(pageable);

        return page.map(categoty -> new CategoryResponseDTO(
                categoty.getCategoryId(),
                categoty.getCategoryKey(),
                categoty.getLabel()));
    }

    public Category findCategoryById(UUID categoryId) {
        return this.categoryRepository.findById(categoryId).orElseThrow(()-> new ResourceNotFoundException(categoryId));
    }

    public CategoryResponseDTO findCategoryByIdAndConvert(UUID categoryId) {
        Category found = this.categoryRepository.findById(categoryId).orElseThrow(()-> new ResourceNotFoundException(categoryId));

        return new CategoryResponseDTO(
                found.getCategoryId(),
                found.getCategoryKey(),
                found.getLabel());
    }


    public CategoryResponseDTO saveCategory(NewCategoryDTO payload) {

        if (categoryRepository.findByCategoryKey(payload.categoryKey()).isPresent()) {
            throw new BadRequestException("Esiste già una categoria con la stessa chiave!");
        }

        if (categoryRepository.findByLabel(payload.label()).isPresent()) {
            throw new BadRequestException("Esiste già una categoria con la stessa etichetta!");
        }

        Category newCategory = new Category(payload.categoryKey(), payload.label());
        Category savedCategory = categoryRepository.save(newCategory);

        log.info("Categoria {} con chiave {} è stata salvata!", savedCategory.getCategoryId(), savedCategory.getCategoryKey());


        return new CategoryResponseDTO(savedCategory.getCategoryId(), savedCategory.getCategoryKey(), savedCategory.getLabel());
    }

    @Transactional
    public CategoryResponseDTO findCategoryByIdAndUpdate(UUID categoryId, NewCategoryDTO payload) {
        Category found = findCategoryById(categoryId);

        categoryRepository.findByCategoryKey(payload.categoryKey())
                .filter(c -> !c.getCategoryId().equals(categoryId))
                .ifPresent(c -> { throw new BadRequestException("Esiste già una categoria con la stessa chiave!"); });

        categoryRepository.findByLabel(payload.label())
                .filter(c -> !c.getCategoryId().equals(categoryId))
                .ifPresent(c -> { throw new BadRequestException("Esiste già una categoria con la stessa etichetta!"); });

        found.setCategoryKey(payload.categoryKey());
        found.setLabel(payload.label());

        Category modifiedCategory = categoryRepository.save(found);

        log.info("Categoria {} con chiave {} è stata modificata!", modifiedCategory.getCategoryId(), modifiedCategory.getCategoryKey());

        return new CategoryResponseDTO(modifiedCategory.getCategoryId(), modifiedCategory.getCategoryKey(), modifiedCategory.getLabel());
    }

    @Transactional
    public void findCategoryByIdAndDelete(UUID categoryId) {
        Category found = findCategoryById(categoryId);
        categoryRepository.delete(found);
        log.info("Categoria {} con chiave {} è stata eliminata!", found.getCategoryId(), found.getCategoryKey());
    }

}
