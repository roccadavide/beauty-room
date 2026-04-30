package daviderocca.beautyroom.likes;

import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.entities.Result;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.repositories.ResultRepository;
import daviderocca.beautyroom.repositories.ServiceItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LikeService {

    private final LikeRepository likeRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final ProductRepository productRepository;
    private final ResultRepository resultRepository;

    private static final Set<String> VALID_TYPES = Set.of("SERVICE", "PRODUCT", "RESULT");

    /**
     * Registra un like per l'entità specificata.
     * Rate limit: 1 like per IP (hashed) per entità ogni 24h.
     * Se il rate limit è attivo restituisce il contatore corrente senza modificarlo.
     */
    @Transactional
    public int addLike(String entityType, UUID entityId, String rawIp) {
        String type = entityType.toUpperCase();
        if (!VALID_TYPES.contains(type)) {
            throw new IllegalArgumentException("Tipo entità non valido: " + type);
        }

        String ipHash = hashIp(rawIp);
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);

        boolean alreadyLiked = likeRepository
                .existsByEntityTypeAndEntityIdAndIpHashAndCreatedAtAfter(
                        type, entityId, ipHash, cutoff);

        if (alreadyLiked) {
            return getCurrentCount(type, entityId);
        }

        likeRepository.save(Like.builder()
                .entityType(type)
                .entityId(entityId)
                .ipHash(ipHash)
                .createdAt(LocalDateTime.now())
                .build());

        return incrementCount(type, entityId);
    }

    @Transactional
    public int removeLike(String entityType, UUID entityId, String rawIp) {
        String type = entityType.toUpperCase();
        if (!VALID_TYPES.contains(type)) {
            throw new IllegalArgumentException("Tipo entita non valido: " + type);
        }

        String ipHash = hashIp(rawIp);
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);

        // Trova ed elimina i like recenti di questo IP per questa entita
        List<Like> recent = likeRepository
            .findByEntityTypeAndEntityIdAndIpHashAndCreatedAtAfter(
                type, entityId, ipHash, cutoff);

        if (recent.isEmpty()) {
            return getCurrentCount(type, entityId);
        }

        likeRepository.deleteAll(recent);
        return decrementCount(type, entityId);
    }

    private int getCurrentCount(String type, UUID id) {
        return switch (type) {
            case "SERVICE" -> serviceItemRepository.findById(id)
                    .map(ServiceItem::getLikesCount).orElse(0);
            case "PRODUCT" -> productRepository.findById(id)
                    .map(Product::getLikesCount).orElse(0);
            case "RESULT"  -> resultRepository.findById(id)
                    .map(Result::getLikesCount).orElse(0);
            default -> 0;
        };
    }

    private int incrementCount(String type, UUID id) {
        return switch (type) {
            case "SERVICE" -> {
                serviceItemRepository.incrementLikes(id);
                yield serviceItemRepository.findById(id)
                        .map(ServiceItem::getLikesCount).orElse(0);
            }
            case "PRODUCT" -> {
                productRepository.incrementLikes(id);
                yield productRepository.findById(id)
                        .map(Product::getLikesCount).orElse(0);
            }
            case "RESULT" -> {
                resultRepository.incrementLikes(id);
                yield resultRepository.findById(id)
                        .map(Result::getLikesCount).orElse(0);
            }
            default -> 0;
        };
    }

    private int decrementCount(String type, UUID id) {
        return switch (type) {
            case "SERVICE" -> {
                serviceItemRepository.decrementLikes(id);
                yield serviceItemRepository.findById(id)
                    .map(ServiceItem::getLikesCount).orElse(0);
            }
            case "PRODUCT" -> {
                productRepository.decrementLikes(id);
                yield productRepository.findById(id)
                    .map(Product::getLikesCount).orElse(0);
            }
            case "RESULT" -> {
                resultRepository.decrementLikes(id);
                yield resultRepository.findById(id)
                    .map(Result::getLikesCount).orElse(0);
            }
            default -> 0;
        };
    }

    private String hashIp(String ip) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(ip.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            return ip; // SHA-256 è sempre disponibile in Java — non dovrebbe mai succedere
        }
    }
}
