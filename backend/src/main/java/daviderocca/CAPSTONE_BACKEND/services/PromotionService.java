package daviderocca.CAPSTONE_BACKEND.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import daviderocca.CAPSTONE_BACKEND.DTO.promotionDTOs.NewPromotionDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.promotionDTOs.PromotionResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.*;
import daviderocca.CAPSTONE_BACKEND.enums.DiscountType;
import daviderocca.CAPSTONE_BACKEND.enums.PromotionScope;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final ProductRepository productRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final CategoryRepository categoryRepository;
    private final Cloudinary cloudinary;

    // ---------------------------- FIND METHODS ----------------------------

    @Transactional(readOnly = true)
    public Page<PromotionResponseDTO> findAllPromotions(int pageNumber, int pageSize, String sortBy) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.DESC, sortBy));
        return promotionRepository.findAll(pageable).map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    public Promotion findById(UUID promotionId) {
        return promotionRepository.findById(promotionId)
                .orElseThrow(() -> new ResourceNotFoundException(promotionId));
    }

    @Transactional(readOnly = true)
    public PromotionResponseDTO findByIdAndConvert(UUID promotionId) {
        return convertToDTO(findById(promotionId));
    }

    @Transactional(readOnly = true)
    public List<PromotionResponseDTO> findActivePromotions() {
        List<Promotion> active = promotionRepository.findActive(LocalDate.now());
        return active.stream().map(this::convertToDTO).toList();
    }

    @Transactional(readOnly = true)
    public List<PromotionResponseDTO> findByScope(PromotionScope scope) {
        return promotionRepository.findAll().stream()
                .filter(p -> p.getScope() == scope && p.isCurrentlyActive())
                .sorted(Comparator.comparingInt(Promotion::getPriority).reversed())
                .map(this::convertToDTO)
                .toList();
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public PromotionResponseDTO createPromotion(NewPromotionDTO payload,
                                                MultipartFile bannerImage,
                                                MultipartFile cardImage) {

        validatePromotionPayload(payload);

        Promotion newPromo = new Promotion();
        mapCommonFields(newPromo, payload);

        // Gestione immagini
        if (bannerImage != null && !bannerImage.isEmpty())
            newPromo.setBannerImageUrl(uploadImage(bannerImage));
        if (cardImage != null && !cardImage.isEmpty())
            newPromo.setCardImageUrl(uploadImage(cardImage));

        // Gestione relazioni
        mapRelations(newPromo, payload);

        Promotion saved = promotionRepository.save(newPromo);
        log.info("Promozione '{}' creata (ID: {}, scope: {})",
                saved.getTitle(), saved.getPromotionId(), saved.getScope());
        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE ----------------------------

    @Transactional
    public PromotionResponseDTO updatePromotion(UUID promotionId,
                                                NewPromotionDTO payload,
                                                MultipartFile bannerImage,
                                                MultipartFile cardImage) {

        Promotion found = findById(promotionId);
        validatePromotionPayload(payload);
        mapCommonFields(found, payload);

        if (bannerImage != null && !bannerImage.isEmpty())
            found.setBannerImageUrl(uploadImage(bannerImage));
        if (cardImage != null && !cardImage.isEmpty())
            found.setCardImageUrl(uploadImage(cardImage));

        mapRelations(found, payload);

        Promotion updated = promotionRepository.save(found);
        log.info("Promozione '{}' aggiornata (ID: {})", updated.getTitle(), updated.getPromotionId());
        return convertToDTO(updated);
    }

    // ---------------------------- DELETE ----------------------------

    @Transactional
    public void deletePromotion(UUID promotionId) {
        Promotion found = findById(promotionId);
        promotionRepository.delete(found);
        log.info("Promozione '{}' (ID: {}) eliminata correttamente.", found.getTitle(), found.getPromotionId());
    }

    // ---------------------------- VALIDATION ----------------------------

    private void validatePromotionPayload(NewPromotionDTO dto) {
        if (dto.discountValue() == null || dto.discountValue().doubleValue() <= 0)
            throw new BadRequestException("Il valore dello sconto deve essere maggiore di zero.");

        if (dto.discountType() == DiscountType.PERCENTAGE &&
                (dto.discountValue().doubleValue() <= 0 || dto.discountValue().doubleValue() > 100))
            throw new BadRequestException("La percentuale di sconto deve essere tra 1 e 100.");

        if (dto.startDate() != null && dto.endDate() != null && dto.startDate().isAfter(dto.endDate()))
            throw new BadRequestException("La data di inizio non può essere successiva alla data di fine.");

        if (dto.scope() != PromotionScope.GLOBAL &&
                (isEmpty(dto.productIds()) && isEmpty(dto.serviceIds()) && isEmpty(dto.categoryIds())))
            throw new BadRequestException("Devi specificare almeno un elemento associato per questo tipo di promozione.");
    }

    private boolean isEmpty(List<?> list) {
        return list == null || list.isEmpty();
    }

    // ---------------------------- RELATIONS ----------------------------

    private void mapRelations(Promotion promo, NewPromotionDTO dto) {
        promo.getProducts().clear();
        promo.getServices().clear();
        promo.getCategories().clear();

        if (dto.productIds() != null)
            promo.setProducts(productRepository.findAllById(dto.productIds()));
        if (dto.serviceIds() != null)
            promo.setServices(serviceItemRepository.findAllById(dto.serviceIds()));
        if (dto.categoryIds() != null)
            promo.setCategories(categoryRepository.findAllById(dto.categoryIds()));
    }

    // ---------------------------- COMMON FIELDS ----------------------------

    private void mapCommonFields(Promotion promo, NewPromotionDTO dto) {
        promo.setTitle(dto.title());
        promo.setSubtitle(dto.subtitle());
        promo.setDescription(dto.description());
        promo.setStartDate(dto.startDate());
        promo.setEndDate(dto.endDate());
        promo.setActive(dto.active());
        promo.setOnlineOnly(dto.onlineOnly());
        promo.setPriority(dto.priority());
        promo.setCtaLabel(dto.ctaLabel());
        promo.setCtaLink(dto.ctaLink());
        promo.setDiscountType(dto.discountType());
        promo.setDiscountValue(dto.discountValue());
        promo.setScope(dto.scope());
    }

    // ---------------------------- CLOUDINARY ----------------------------

    private String uploadImage(MultipartFile image) {
        try {
            Map uploadResult = cloudinary.uploader().upload(image.getBytes(), ObjectUtils.emptyMap());
            String url = (String) uploadResult.get("url");
            log.info("Immagine caricata su Cloudinary: {}", url);
            return url;
        } catch (IOException e) {
            log.error("Errore durante l'upload immagine su Cloudinary", e);
            throw new BadRequestException("Errore durante il caricamento dell'immagine");
        }
    }

    // ---------------------------- CONVERTER ----------------------------

    private PromotionResponseDTO convertToDTO(Promotion p) {
        return new PromotionResponseDTO(
                p.getPromotionId(),
                p.getTitle(),
                p.getSubtitle(),
                p.getDescription(),
                p.getBannerImageUrl(),
                p.getCardImageUrl(),
                p.getCtaLabel(),
                p.getCtaLink(),
                p.getDiscountType(),
                p.getDiscountValue(),
                p.getScope(),
                p.getStartDate(),
                p.getEndDate(),
                p.isActive(),
                p.isOnlineOnly(),
                p.getPriority(),
                p.getProducts().stream().map(Product::getProductId).collect(Collectors.toList()),
                p.getServices().stream().map(ServiceItem::getServiceId).collect(Collectors.toList()),
                p.getCategories().stream().map(Category::getCategoryId).collect(Collectors.toList()),
                p.getCreatedAt(),
                p.getUpdatedAt(),
                p.isCurrentlyActive()
        );
    }
}