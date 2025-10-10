package daviderocca.CAPSTONE_BACKEND.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import daviderocca.CAPSTONE_BACKEND.DTO.NewResultDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.ResultResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Category;
import daviderocca.CAPSTONE_BACKEND.entities.Result;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.ResultRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

@Service
@Slf4j
public class ResultService {

    @Autowired
    private ResultRepository resultRepository;

    @Autowired
    private CategoryService categoryService;

    @Autowired
    private Cloudinary cloudinary;

    // ---------------------------- FIND METHODS ----------------------------

    @Transactional(readOnly = true)
    public Page<ResultResponseDTO> findAllResults(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<Result> page = resultRepository.findAll(pageable);
        return page.map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    public Result findResultById(UUID resultId) {
        return resultRepository.findById(resultId)
                .orElseThrow(() -> new ResourceNotFoundException(resultId));
    }

    @Transactional(readOnly = true)
    public ResultResponseDTO findResultByIdAndConvert(UUID resultId) {
        return convertToDTO(findResultById(resultId));
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public ResultResponseDTO saveResult(NewResultDTO payload, MultipartFile image) {
        if (resultRepository.existsByTitle(payload.title())) {
            throw new BadRequestException("Esiste già un risultato con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());
        List<String> images = uploadImageIfPresent(image);

        Result newResult = new Result(
                payload.title(),
                payload.shortDescription(),
                payload.description(),
                images,
                relatedCategory
        );

        Result saved = resultRepository.save(newResult);
        log.info("Risultato '{}' (ID: {}) creato con categoria '{}'",
                saved.getTitle(), saved.getResultId(), relatedCategory.getCategoryKey());

        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE ----------------------------

    @Transactional
    public ResultResponseDTO updateResult(UUID resultId, NewResultDTO payload, MultipartFile image) {
        Result found = findResultById(resultId);

        if (resultRepository.existsByTitleAndResultIdNot(payload.title(), resultId)) {
            throw new BadRequestException("Esiste già un risultato con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());
        List<String> images = found.getImages();

        if (image != null && !image.isEmpty()) {
            images = uploadImageIfPresent(image);
        }

        found.setTitle(payload.title());
        found.setShortDescription(payload.shortDescription());
        found.setDescription(payload.description());
        found.setCategory(relatedCategory);
        found.setImages(images);

        Result updated = resultRepository.save(found);
        log.info("Risultato '{}' (ID: {}) aggiornato (categoria: {})",
                updated.getTitle(), updated.getResultId(), relatedCategory.getCategoryKey());

        return convertToDTO(updated);
    }

    // ---------------------------- DELETE ----------------------------

    @Transactional
    public void deleteResult(UUID resultId) {
        Result found = findResultById(resultId);
        resultRepository.delete(found);
        log.info("Risultato '{}' (ID: {}) eliminato con successo.", found.getTitle(), found.getResultId());
    }

    // ---------------------------- CLOUDINARY ----------------------------
    private List<String> uploadImageIfPresent(MultipartFile image) {
        List<String> images = new ArrayList<>();
        if (image != null && !image.isEmpty()) {
            try {
                Map uploadResult = cloudinary.uploader()
                        .upload(image.getBytes(), ObjectUtils.emptyMap());
                String url = (String) uploadResult.get("url");
                images.add(url);
                log.info("Immagine caricata su Cloudinary: {}", url);
            } catch (IOException e) {
                log.error("Errore durante l'upload dell'immagine su Cloudinary", e);
                throw new BadRequestException("Errore durante l'upload dell'immagine");
            }
        }
        return images;
    }

    // ---------------------------- CONVERTER ----------------------------
    private ResultResponseDTO convertToDTO(Result result) {
        return new ResultResponseDTO(
                result.getResultId(),
                result.getTitle(),
                result.getShortDescription(),
                result.getDescription(),
                result.getImages(),
                result.getCategory() != null ? result.getCategory().getCategoryId() : null,
                result.getCreatedAt()
        );
    }
}