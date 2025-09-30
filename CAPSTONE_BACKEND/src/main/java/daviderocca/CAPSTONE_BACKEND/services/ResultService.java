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
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
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
    private Cloudinary imageUploader;


    public Page<ResultResponseDTO> findAllResults(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort).descending());
        Page<Result> page = this.resultRepository.findAll(pageable);

        return page.map(result -> new ResultResponseDTO(
                result.getResultId(),
                result.getTitle(),
                result.getShortDescription(),
                result.getDescription(),
                result.getImages(),
                result.getCategory() != null ? result.getCategory().getCategoryId() : null,
                result.getCreatedAt()
        ));
    }

    public Result findResultById(UUID resultId) {
        return this.resultRepository.findById(resultId)
                .orElseThrow(() -> new ResourceNotFoundException(resultId));
    }

    public ResultResponseDTO findResultByIdAndConvert(UUID resultId) {
        Result found = findResultById(resultId);

        return new ResultResponseDTO(
                found.getResultId(),
                found.getTitle(),
                found.getShortDescription(),
                found.getDescription(),
                found.getImages(),
                found.getCategory() != null ? found.getCategory().getCategoryId() : null,
                found.getCreatedAt()
        );
    }


    public ResultResponseDTO saveResult(NewResultDTO payload, MultipartFile image) {
        if (resultRepository.existsByTitle(payload.title())) {
            throw new IllegalArgumentException("Esiste già un risultato con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());

        List<String> images = new ArrayList<>();
        if (image != null && !image.isEmpty()) {
            try {
                String url = (String) imageUploader.uploader()
                        .upload(image.getBytes(), ObjectUtils.emptyMap())
                        .get("url");
                images.add(url);
            } catch (IOException e) {
                throw new BadRequestException("Errore durante l'upload dell'immagine");
            }
        }

        Result newResult = new Result(
                payload.title(),
                payload.shortDescription(),
                payload.description(),
                images,
                relatedCategory
        );

        Result saved = resultRepository.save(newResult);

        log.info("Risultato {} ({} - categoria {}) creato", saved.getResultId(), saved.getTitle(), relatedCategory.getCategoryId());

        return new ResultResponseDTO(
                saved.getResultId(),
                saved.getTitle(),
                saved.getShortDescription(),
                saved.getDescription(),
                saved.getImages(),
                relatedCategory.getCategoryId(),
                saved.getCreatedAt()
        );
    }


    @Transactional
    public ResultResponseDTO updateResult(UUID resultId, NewResultDTO payload, MultipartFile image) {
        Result found = findResultById(resultId);

        if (resultRepository.existsByTitleAndResultIdNot(payload.title(), resultId)) {
            throw new IllegalArgumentException("Esiste già un risultato con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());

        List<String> images = found.getImages();

        if (image != null && !image.isEmpty()) {
            try {
                String url = (String) imageUploader.uploader()
                        .upload(image.getBytes(), ObjectUtils.emptyMap())
                        .get("url");
                images = new ArrayList<>();
                images.add(url);
                found.setImages(images);
            } catch (IOException e) {
                throw new BadRequestException("Errore durante l'upload dell'immagine");
            }
        }

        found.setTitle(payload.title());
        found.setShortDescription(payload.shortDescription());
        found.setDescription(payload.description());
        found.setCategory(relatedCategory);

        Result modified = resultRepository.save(found);

        log.info("Risultato {} aggiornato (categoria: {})", modified.getResultId(), relatedCategory.getCategoryKey());

        return new ResultResponseDTO(
                modified.getResultId(),
                modified.getTitle(),
                modified.getShortDescription(),
                modified.getDescription(),
                modified.getImages(),
                relatedCategory.getCategoryId(),
                modified.getCreatedAt()
        );
    }


    @Transactional
    public void deleteResult(UUID resultId) {
        Result found = findResultById(resultId);
        resultRepository.delete(found);
        log.info("Risultato {} eliminato!", found.getResultId());
    }
}