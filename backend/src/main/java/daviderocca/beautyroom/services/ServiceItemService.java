package daviderocca.beautyroom.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import daviderocca.beautyroom.DTO.serviceItemDTOs.NewServiceItemDTO;
import daviderocca.beautyroom.DTO.serviceItemDTOs.PackageResponseDTO;
import daviderocca.beautyroom.DTO.serviceItemDTOs.ServiceItemResponseDTO;
import daviderocca.beautyroom.DTO.serviceItemDTOs.ServiceOptionRequestDTO;
import daviderocca.beautyroom.DTO.serviceItemDTOs.ServiceOptionResponseDTO;
import daviderocca.beautyroom.entities.Category;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.util.BadgesUtil;
import daviderocca.beautyroom.repositories.ServiceItemRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
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

    private final ServiceOptionRepository serviceOptionRepository;

    private final CategoryService categoryService;

    private final Cloudinary cloudinary;

    // ---------------------------- PACKAGES ----------------------------

    @Transactional(readOnly = true)
    public List<PackageResponseDTO> getActivePackages() {
        return serviceOptionRepository.findActivePackages()
                .stream()
                .filter(so -> so.getService() != null && so.getService().isActive())
                .map(so -> {
                    ServiceItem si = so.getService();
                    String imageUrl = (si.getImages() == null || si.getImages().isEmpty())
                            ? null
                            : si.getImages().iterator().next();
                    return new PackageResponseDTO(
                            so.getOptionId(),
                            si.getServiceId(),
                            si.getTitle(),
                            imageUrl,
                            so.getName(),
                            so.getSessions(),
                            so.getPrice(),
                            so.getOptionGroup(),
                            so.getGender(),
                            so.isActive(),
                            BadgesUtil.fromJson(so.getBadges())
                    );
                })
                .toList();
    }

    // ---------------------------- OPTION CRUD ----------------------------

    @Transactional
    public ServiceOptionResponseDTO createOption(UUID serviceId, ServiceOptionRequestDTO dto) {
        ServiceItem si = serviceItemRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException(serviceId));
        ServiceOption opt = new ServiceOption();
        opt.setName(dto.name());
        opt.setPrice(dto.price());
        opt.setSessions(dto.sessions());
        opt.setOptionGroup(dto.optionGroup());
        opt.setGender(dto.gender());
        opt.setActive(dto.active());
        opt.setDurationMin(dto.durationMin());
        opt.setService(si);
        opt.setBadges(BadgesUtil.toJson(BadgesUtil.validate(dto.badges())));
        return toOptionDTO(serviceOptionRepository.save(opt));
    }

    @Transactional
    public ServiceOptionResponseDTO updateOption(UUID optionId, ServiceOptionRequestDTO dto) {
        ServiceOption opt = serviceOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException(optionId));
        opt.setName(dto.name());
        opt.setPrice(dto.price());
        opt.setSessions(dto.sessions());
        opt.setOptionGroup(dto.optionGroup());
        opt.setGender(dto.gender());
        opt.setActive(dto.active());
        opt.setDurationMin(dto.durationMin());
        opt.setBadges(BadgesUtil.toJson(BadgesUtil.validate(dto.badges())));
        return toOptionDTO(serviceOptionRepository.save(opt));
    }

    @Transactional
    public void deleteOption(UUID optionId) {
        if (!serviceOptionRepository.existsById(optionId)) {
            throw new ResourceNotFoundException(optionId);
        }
        serviceOptionRepository.deleteById(optionId);
    }

    private ServiceOptionResponseDTO toOptionDTO(ServiceOption o) {
        return new ServiceOptionResponseDTO(
                o.getOptionId(), o.getName(), o.getPrice(),
                o.getSessions(), o.getDurationMin(), o.getGender(), o.isActive(), o.getOptionGroup(),
                BadgesUtil.fromJson(o.getBadges())
        );
    }

    // ---------------------------- FIND METHODS ----------------------------

    @Transactional(readOnly = true)
    public Page<ServiceItemResponseDTO> findAllServiceItems(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<ServiceItem> page = serviceItemRepository.findAllActiveWithDetails(pageable);
        List<ServiceItemResponseDTO> dtoList = page.getContent().stream().map(this::convertToDTO).toList();
        return new PageImpl<>(dtoList, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ServiceItem findServiceItemById(UUID serviceItemId) {
        return serviceItemRepository.findById(serviceItemId)
                .orElseThrow(() -> new ResourceNotFoundException(serviceItemId));
    }

    /**
     * Prenotazioni, disponibilità, checkout: il servizio deve essere attivo.
     */
    public void assertServiceActive(ServiceItem serviceItem) {
        if (!serviceItem.isActive()) {
            throw new BadRequestException("Il servizio non è disponibile.");
        }
    }

    @Transactional(readOnly = true)
    public ServiceItemResponseDTO findServiceItemByIdAndConvert(UUID serviceItemId) {
        ServiceItem serviceItem = serviceItemRepository.findByIdWithDetails(serviceItemId)
                .orElseThrow(() -> new ResourceNotFoundException(serviceItemId));
        if (!serviceItem.isActive()) {
            throw new ResourceNotFoundException(serviceItemId);
        }
        return convertToDTO(serviceItem);
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public ServiceItemResponseDTO saveServiceItem(NewServiceItemDTO payload, List<MultipartFile> images) {
        if (serviceItemRepository.existsByTitle(payload.title())) {
            throw new BadRequestException("Esiste già un servizio con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());
        List<String> imageUrls = uploadImagesIfPresent(images);

        ServiceItem newServiceItem = new ServiceItem(
                payload.title(),
                payload.durationMin(),
                payload.price(),
                payload.shortDescription(),
                payload.description(),
                imageUrls,
                relatedCategory
        );

        newServiceItem.setActive(payload.active() == null || payload.active());
        newServiceItem.setBadges(BadgesUtil.toJson(BadgesUtil.validate(payload.badges())));

        ServiceItem saved = serviceItemRepository.save(newServiceItem);
        log.info("Servizio '{}' (ID: {}) creato (categoria: {})",
                saved.getTitle(), saved.getServiceId(), relatedCategory.getCategoryKey());

        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE ----------------------------

    @Transactional
    public ServiceItemResponseDTO updateServiceItem(UUID serviceItemId, NewServiceItemDTO payload, List<MultipartFile> images) {
        ServiceItem found = findServiceItemById(serviceItemId);

        if (serviceItemRepository.existsByTitleAndServiceIdNot(payload.title(), serviceItemId)) {
            throw new BadRequestException("Esiste già un altro servizio con questo titolo!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());

        // Rimuovi URL segnalate per rimozione
        LinkedHashSet<String> currentImages = new LinkedHashSet<>(found.getImages());
        if (payload.removedImageUrls() != null && !payload.removedImageUrls().isEmpty()) {
            for (String url : payload.removedImageUrls()) {
                currentImages.remove(url);
                // TODO: cancella da Cloudinary (richiede estrazione publicId dall'URL)
                log.info("Immagine rimossa dalla lista del servizio: {}", url);
            }
        }

        // Aggiungi nuove immagini
        if (images != null && !images.isEmpty()) {
            currentImages.addAll(uploadImagesIfPresent(images));
        }

        found.setImages(currentImages);
        found.setTitle(payload.title());
        found.setDurationMin(payload.durationMin());
        found.setPrice(payload.price());
        found.setShortDescription(payload.shortDescription());
        found.setDescription(payload.description());
        found.setCategory(relatedCategory);
        if (payload.active() != null) {
            found.setActive(payload.active());
        }
        found.setBadges(BadgesUtil.toJson(BadgesUtil.validate(payload.badges())));

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

    @Transactional
    public void toggleActive(UUID id) {
        ServiceItem entity = serviceItemRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException(id));
        entity.setActive(!entity.isActive());
        serviceItemRepository.save(entity);
    }

    @Transactional
    public ServiceItemResponseDTO setFeatured(UUID id, boolean value) {
        ServiceItem entity = serviceItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(id));
        if (value && serviceItemRepository.countByFeaturedTrue() >= 5) {
            throw new IllegalStateException("Massimo 5 trattamenti in evidenza");
        }
        entity.setFeatured(value);
        return convertToDTO(serviceItemRepository.save(entity));
    }

    @Transactional
    public void toggleOptionActive(UUID optionId) {
        ServiceOption opt = serviceOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException(optionId));
        opt.setActive(!opt.isActive());
        serviceOptionRepository.save(opt);
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
    private ServiceItemResponseDTO convertToDTO(ServiceItem serviceItem) {
        List<ServiceOptionResponseDTO> optionDTOs = serviceItem.getOptions().stream()
                .filter(ServiceOption::isActive)
                .map(this::toOptionDTO)
                .toList();

        return new ServiceItemResponseDTO(
                serviceItem.getServiceId(),
                serviceItem.getTitle(),
                serviceItem.getDurationMin(),
                serviceItem.getPrice(),
                serviceItem.getShortDescription(),
                serviceItem.getDescription(),
                new java.util.ArrayList<>(serviceItem.getImages()),
                serviceItem.getCategory() != null ? serviceItem.getCategory().getCategoryId() : null,
                serviceItem.getCategory() != null ? serviceItem.getCategory().getCategoryKey() : null,
                serviceItem.isActive(),
                optionDTOs,
                BadgesUtil.fromJson(serviceItem.getBadges()),
                serviceItem.isFeatured()
        );
    }
}