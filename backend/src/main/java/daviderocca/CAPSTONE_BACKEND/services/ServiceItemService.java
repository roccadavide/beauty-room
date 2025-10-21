package daviderocca.CAPSTONE_BACKEND.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs.NewServiceItemDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs.ServiceItemResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Category;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.ServiceItemRepository;
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
public class ServiceItemService {


    private final ServiceItemRepository serviceItemRepository;

    private final CategoryService categoryService;

    private final Cloudinary cloudinary;

    // ---------------------------- FIND METHODS ----------------------------

    @Transactional(readOnly = true)
    public Page<ServiceItemResponseDTO> findAllServiceItems(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<ServiceItem> page = serviceItemRepository.findAll(pageable);
        return page.map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    public ServiceItem findServiceItemById(UUID serviceItemId) {
        return serviceItemRepository.findById(serviceItemId)
                .orElseThrow(() -> new ResourceNotFoundException(serviceItemId));
    }

    @Transactional(readOnly = true)
    public ServiceItemResponseDTO findServiceItemByIdAndConvert(UUID serviceItemId) {
        return convertToDTO(findServiceItemById(serviceItemId));
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public ServiceItemResponseDTO saveServiceItem(NewServiceItemDTO payload, MultipartFile image) {
        if (serviceItemRepository.existsByTitle(payload.title())) {
            throw new BadRequestException("Esiste già un servizio con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());
        List<String> images = uploadImageIfPresent(image);

        ServiceItem newServiceItem = new ServiceItem(
                payload.title(),
                payload.durationMin(),
                payload.price(),
                payload.shortDescription(),
                payload.description(),
                images,
                relatedCategory
        );

        ServiceItem saved = serviceItemRepository.save(newServiceItem);
        log.info("Servizio '{}' (ID: {}) creato (categoria: {})",
                saved.getTitle(), saved.getServiceId(), relatedCategory.getCategoryKey());

        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE ----------------------------

    @Transactional
    public ServiceItemResponseDTO updateServiceItem(UUID serviceItemId, NewServiceItemDTO payload, MultipartFile image) {
        ServiceItem found = findServiceItemById(serviceItemId);

        if (serviceItemRepository.existsByTitleAndServiceIdNot(payload.title(), serviceItemId)) {
            throw new BadRequestException("Esiste già un altro servizio con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());
        List<String> images = found.getImages();

        if (image != null && !image.isEmpty()) {
            images = uploadImageIfPresent(image);
            found.setImages(images);
        }

        found.setTitle(payload.title());
        found.setDurationMin(payload.durationMin());
        found.setPrice(payload.price());
        found.setShortDescription(payload.shortDescription());
        found.setDescription(payload.description());
        found.setCategory(relatedCategory);

        ServiceItem updated = serviceItemRepository.save(found);
        log.info("Servizio '{}' (ID: {}) aggiornato (categoria: {})",
                updated.getTitle(), updated.getServiceId(), relatedCategory.getCategoryKey());

        return convertToDTO(updated);
    }

    // ---------------------------- DELETE ----------------------------

    @Transactional
    public void deleteServiceItem(UUID serviceItemId) {
        ServiceItem found = findServiceItemById(serviceItemId);
        serviceItemRepository.delete(found);
        log.info("Servizio '{}' (ID: {}) eliminato correttamente.", found.getTitle(), found.getServiceId());
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
    private ServiceItemResponseDTO convertToDTO(ServiceItem serviceItem) {
        return new ServiceItemResponseDTO(
                serviceItem.getServiceId(),
                serviceItem.getTitle(),
                serviceItem.getDurationMin(),
                serviceItem.getPrice(),
                serviceItem.getShortDescription(),
                serviceItem.getDescription(),
                serviceItem.getImages(),
                serviceItem.getCategory() != null ? serviceItem.getCategory().getCategoryId() : null
        );
    }
}