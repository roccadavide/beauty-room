package daviderocca.beautyroom.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import daviderocca.beautyroom.DTO.resultDTOs.NewResultDTO;
import daviderocca.beautyroom.DTO.resultDTOs.ResultResponseDTO;
import daviderocca.beautyroom.entities.Category;
import daviderocca.beautyroom.entities.Result;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.repositories.ResultRepository;
import daviderocca.beautyroom.repositories.ServiceItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ResultService {

    private final ResultRepository resultRepository;

    private final ServiceItemRepository serviceItemRepository;

    private final CategoryService categoryService;

    private final Cloudinary cloudinary;

    // ---------------------------- FIND METHODS ----------------------------

    @Transactional(readOnly = true)
    public Page<ResultResponseDTO> findAllResults(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<Result> page = resultRepository.findAllActiveWithDetails(pageable);
        List<ResultResponseDTO> dtoList = page.getContent().stream().map(this::convertToDTO).toList();
        return new PageImpl<>(dtoList, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Result findResultById(UUID resultId) {
        return resultRepository.findById(resultId)
                .orElseThrow(() -> new ResourceNotFoundException(resultId));
    }

    @Transactional(readOnly = true)
    public ResultResponseDTO findResultByIdAndConvert(UUID resultId) {
        Result result = resultRepository.findByIdWithDetails(resultId)
                .orElseThrow(() -> new ResourceNotFoundException(resultId));
        if (!result.isActive()) {
            throw new ResourceNotFoundException(resultId);
        }
        return convertToDTO(result);
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public ResultResponseDTO saveResult(NewResultDTO payload, List<MultipartFile> images) {
        if (resultRepository.existsByTitle(payload.title())) {
            throw new BadRequestException("Esiste già un risultato con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());
        List<String> imageUrls = uploadImagesIfPresent(images);

        Result newResult = new Result(
                payload.title(),
                payload.shortDescription(),
                payload.description(),
                imageUrls,
                relatedCategory
        );
        newResult.setActive(payload.active() == null || payload.active());
        applyLinkedService(newResult, payload.linkedServiceId());

        Result saved = resultRepository.save(newResult);
        log.info("Risultato '{}' (ID: {}) creato con categoria '{}'",
                saved.getTitle(), saved.getResultId(), relatedCategory.getCategoryKey());

        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE ----------------------------

    @Transactional
    public ResultResponseDTO updateResult(UUID resultId, NewResultDTO payload, List<MultipartFile> images) {
        Result found = resultRepository.findByIdWithDetails(resultId)
                .orElseThrow(() -> new ResourceNotFoundException(resultId));

        if (resultRepository.existsByTitleAndResultIdNot(payload.title(), resultId)) {
            throw new BadRequestException("Esiste già un risultato con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());

        // Rimuovi URL segnalate per rimozione
        List<String> currentImages = new ArrayList<>(found.getImages());
        if (payload.removedImageUrls() != null && !payload.removedImageUrls().isEmpty()) {
            for (String url : payload.removedImageUrls()) {
                currentImages.remove(url);
                // TODO: cancella da Cloudinary (richiede estrazione publicId dall'URL)
                log.info("Immagine rimossa dalla lista del risultato: {}", url);
            }
        }

        // Aggiungi nuove immagini
        if (images != null && !images.isEmpty()) {
            currentImages.addAll(uploadImagesIfPresent(images));
        }

        found.setTitle(payload.title());
        found.setShortDescription(payload.shortDescription());
        found.setDescription(payload.description());
        found.setCategory(relatedCategory);
        found.setImages(currentImages);
        if (payload.active() != null) {
            found.setActive(payload.active());
        }
        applyLinkedService(found, payload.linkedServiceId());

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

    @Transactional
    public void toggleActive(UUID id) {
        Result entity = resultRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException(id));
        entity.setActive(!entity.isActive());
        resultRepository.save(entity);
    }

    private void applyLinkedService(Result result, UUID linkedServiceId) {
        if (linkedServiceId != null) {
            ServiceItem linked = serviceItemRepository.findById(linkedServiceId)
                    .orElseThrow(() -> new ResourceNotFoundException(linkedServiceId));
            result.setLinkedService(linked);
        } else {
            result.setLinkedService(null);
        }
    }

    // ---------------------------- CLOUDINARY ----------------------------
    private List<String> uploadImagesIfPresent(List<MultipartFile> files) {
        List<String> urls = new ArrayList<>();
        if (files == null) return urls;
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) continue;
            try {
                Map uploadResult = cloudinary.uploader()
                        .upload(file.getBytes(), ObjectUtils.emptyMap());
                String url = (String) uploadResult.get("url");
                urls.add(url);
                log.info("Immagine caricata su Cloudinary: {}", url);
            } catch (IOException e) {
                log.error("Errore durante l'upload dell'immagine su Cloudinary", e);
                throw new BadRequestException("Errore durante l'upload dell'immagine");
            }
        }
        return urls;
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
                result.isActive(),
                result.getLinkedService() != null ? result.getLinkedService().getServiceId() : null,
                result.getLinkedService() != null ? result.getLinkedService().getTitle() : null,
                result.getCreatedAt()
        );
    }
}