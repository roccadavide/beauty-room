package daviderocca.CAPSTONE_BACKEND.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs.NewServiceItemDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs.PackageResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs.ServiceItemResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs.ServiceOptionRequestDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs.ServiceOptionResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Category;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceOption;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.ServiceItemRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.ServiceOptionRepository;
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
                            so.getGender()
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
        opt.setService(si);
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
                o.getSessions(), o.getGender(), o.isActive(), o.getOptionGroup()
        );
    }

    // ---------------------------- FIND METHODS ----------------------------

    @Transactional(readOnly = true)
    public Page<ServiceItemResponseDTO> findAllServiceItems(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<ServiceItem> page = serviceItemRepository.findAllWithDetails(pageable);
        List<ServiceItemResponseDTO> dtoList = page.getContent().stream().map(this::convertToDTO).toList();
        return new PageImpl<>(dtoList, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ServiceItem findServiceItemById(UUID serviceItemId) {
        return serviceItemRepository.findById(serviceItemId)
                .orElseThrow(() -> new ResourceNotFoundException(serviceItemId));
    }

    @Transactional(readOnly = true)
    public ServiceItemResponseDTO findServiceItemByIdAndConvert(UUID serviceItemId) {
        ServiceItem serviceItem = serviceItemRepository.findByIdWithDetails(serviceItemId)
                .orElseThrow(() -> new ResourceNotFoundException(serviceItemId));
        return convertToDTO(serviceItem);
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

        if (image != null && !image.isEmpty()) {
            List<String> images = uploadImageIfPresent(image);
            found.setImages(new java.util.LinkedHashSet<>(images));
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
        List<ServiceOptionResponseDTO> optionDTOs = serviceItem.getOptions().stream()
                .filter(ServiceOption::isActive)
                .map(o -> new ServiceOptionResponseDTO(
                        o.getOptionId(),
                        o.getName(),
                        o.getPrice(),
                        o.getSessions(),
                        o.getGender(),
                        o.isActive(),
                        // FIX-2: includi optionGroup nel DTO
                        o.getOptionGroup()
                ))
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
                optionDTOs
        );
    }
}