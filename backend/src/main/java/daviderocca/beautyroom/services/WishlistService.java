package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.wishlistDTOs.*;
import daviderocca.beautyroom.email.outbox.EmailOutboxService;
import daviderocca.beautyroom.entities.*;
import daviderocca.beautyroom.enums.WishlistItemType;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.repositories.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class WishlistService {

    private final WishlistItemRepository wishlistItemRepository;
    private final UserRepository userRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final ProductRepository productRepository;
    private final PromotionRepository promotionRepository;
    private final EmailOutboxService emailOutboxService;

    // ---------------------------- TOGGLE ----------------------------

    @Transactional
    public ToggleWishlistResponse toggleWishlist(UUID userId, WishlistItemType type, UUID itemId) {
        validateItemExists(type, itemId);

        Optional<WishlistItem> existing = wishlistItemRepository
                .findByUser_UserIdAndItemTypeAndItemId(userId, type, itemId);

        if (existing.isPresent()) {
            wishlistItemRepository.delete(existing.get());
            return new ToggleWishlistResponse(false, "Rimosso dalla wishlist");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(userId));

        WishlistItem item = new WishlistItem(user, type, itemId);
        wishlistItemRepository.save(item);
        return new ToggleWishlistResponse(true, "Aggiunto alla wishlist");
    }

    // ---------------------------- GET WISHLIST ----------------------------

    @Transactional(readOnly = true)
    public WishlistResponseDTO getWishlistForUser(UUID userId) {
        List<WishlistItem> items = wishlistItemRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);

        List<WishlistItemDTO> dtos = new ArrayList<>();
        for (WishlistItem w : items) {
            WishlistItemDTO dto = enrich(w);
            if (dto != null) {
                dtos.add(dto);
            }
        }

        return new WishlistResponseDTO(dtos, dtos.size());
    }

    // ---------------------------- CHECK ----------------------------

    @Transactional(readOnly = true)
    public boolean isWishlisted(UUID userId, WishlistItemType type, UUID itemId) {
        return wishlistItemRepository.existsByUser_UserIdAndItemTypeAndItemId(userId, type, itemId);
    }

    // ---------------------------- STATS (admin) ----------------------------

    @Transactional(readOnly = true)
    public List<WishlistStatDTO> getWishlistStats() {
        List<Object[]> rows = wishlistItemRepository.countGroupedByTypeAndItem();
        List<WishlistStatDTO> result = new ArrayList<>();

        for (Object[] row : rows) {
            WishlistItemType type = (WishlistItemType) row[0];
            UUID itemId = (UUID) row[1];
            long count = ((Number) row[2]).longValue();
            String name = resolveItemName(type, itemId);
            result.add(new WishlistStatDTO(type, itemId, name, count));
        }

        return result;
    }

    // ---------------------------- REACTIVATION NOTIFY ----------------------------

    @Transactional
    public void notifyWishlistersOnReactivation(WishlistItemType type, UUID itemId, String itemName) {
        List<WishlistItem> wishers = wishlistItemRepository.findByItemTypeAndItemId(type, itemId);
        if (wishers.isEmpty()) return;

        log.info("Notifica wishlist: {} utenti per {} id={}", wishers.size(), type, itemId);

        for (WishlistItem w : wishers) {
            try {
                emailOutboxService.enqueueWishlistBackInStock(w, itemName);
            } catch (Exception ex) {
                log.warn("Impossibile accodare notifica wishlist per user={} item={}: {}",
                        w.getUser().getUserId(), itemId, ex.getMessage());
            }
        }
    }

    // ---------------------------- ENRICHMENT ----------------------------

    /**
     * Arricchisce un WishlistItem con i dati dell'entità corrispondente.
     * Restituisce null se l'item non esiste più nel DB (hard delete già avvenuto).
     */
    private WishlistItemDTO enrich(WishlistItem w) {
        return switch (w.getItemType()) {
            case SERVICE -> enrichService(w);
            case PRODUCT -> enrichProduct(w);
            case PROMOTION -> enrichPromotion(w);
            case PACKAGE -> null; // nessuna entità catalog per i pacchetti
        };
    }

    private WishlistItemDTO enrichService(WishlistItem w) {
        Optional<ServiceItem> opt = serviceItemRepository.findById(w.getItemId());
        if (opt.isEmpty()) return null;
        ServiceItem s = opt.get();
        String imageUrl = (s.getImages() != null && !s.getImages().isEmpty())
                ? s.getImages().iterator().next() : null;
        String cat = s.getCategory() != null ? s.getCategory().getCategoryKey() : null;
        return new WishlistItemDTO(
                w.getId(), w.getItemType(), w.getItemId(), w.getCreatedAt(),
                s.getTitle(), s.getShortDescription(), imageUrl,
                s.getPrice(), s.getDurationMin(), s.getServiceId(),
                s.isActive(), cat
        );
    }

    private WishlistItemDTO enrichProduct(WishlistItem w) {
        Optional<Product> opt = productRepository.findById(w.getItemId());
        if (opt.isEmpty()) return null;
        Product p = opt.get();
        String imageUrl = (p.getImages() != null && !p.getImages().isEmpty())
                ? p.getImages().iterator().next() : null;
        String cat = p.getCategory() != null ? p.getCategory().getCategoryKey() : null;
        return new WishlistItemDTO(
                w.getId(), w.getItemType(), w.getItemId(), w.getCreatedAt(),
                p.getName(), p.getShortDescription(), imageUrl,
                p.getPrice(), null, p.getProductId(),
                p.isActive(), cat
        );
    }

    private WishlistItemDTO enrichPromotion(WishlistItem w) {
        Optional<Promotion> opt = promotionRepository.findById(w.getItemId());
        if (opt.isEmpty()) return null;
        Promotion promo = opt.get();
        return new WishlistItemDTO(
                w.getId(), w.getItemType(), w.getItemId(), w.getCreatedAt(),
                promo.getTitle(), promo.getDescription(), promo.getCardImageUrl(),
                null, null, promo.getPromotionId(),
                promo.isActive(), "Promozione"
        );
    }

    // ---------------------------- VALIDATION ----------------------------

    private void validateItemExists(WishlistItemType type, UUID itemId) {
        switch (type) {
            case SERVICE -> {
                if (!serviceItemRepository.existsById(itemId)) {
                    throw new ResourceNotFoundException("Servizio non trovato: " + itemId);
                }
            }
            case PRODUCT -> {
                if (!productRepository.existsById(itemId)) {
                    throw new ResourceNotFoundException("Prodotto non trovato: " + itemId);
                }
            }
            case PROMOTION -> {
                if (!promotionRepository.existsById(itemId)) {
                    throw new ResourceNotFoundException("Promozione non trovata: " + itemId);
                }
            }
            case PACKAGE -> throw new BadRequestException("Il tipo PACKAGE non è supportato nella wishlist.");
        }
    }

    private String resolveItemName(WishlistItemType type, UUID itemId) {
        return switch (type) {
            case SERVICE -> serviceItemRepository.findById(itemId)
                    .map(ServiceItem::getTitle).orElse("(eliminato)");
            case PRODUCT -> productRepository.findById(itemId)
                    .map(Product::getName).orElse("(eliminato)");
            case PROMOTION -> promotionRepository.findById(itemId)
                    .map(Promotion::getTitle).orElse("(eliminata)");
            case PACKAGE -> "(pacchetto)";
        };
    }
}
