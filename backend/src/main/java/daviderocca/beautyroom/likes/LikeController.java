package daviderocca.beautyroom.likes;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/likes")
@RequiredArgsConstructor
public class LikeController {

    private final LikeService likeService;

    /**
     * POST /api/likes/{entityType}/{entityId}
     * Endpoint pubblico (no auth). Rate limit: 1 like / IP / entità / 24h.
     * Risponde sempre 200 con il contatore aggiornato.
     */
    @PostMapping("/{entityType}/{entityId}")
    public ResponseEntity<Map<String, Object>> addLike(
            @PathVariable String entityType,
            @PathVariable UUID entityId,
            HttpServletRequest request) {

        String rawIp = getClientIp(request);
        int newCount = likeService.addLike(entityType, entityId, rawIp);

        return ResponseEntity.ok(Map.of(
                "likesCount", newCount,
                "entityType", entityType.toUpperCase(),
                "entityId",   entityId
        ));
    }

    @DeleteMapping("/{entityType}/{entityId}")
    public ResponseEntity<Map<String, Object>> removeLike(
            @PathVariable String entityType,
            @PathVariable UUID entityId,
            HttpServletRequest request) {

        String rawIp = getClientIp(request);
        int newCount = likeService.removeLike(entityType, entityId, rawIp);

        return ResponseEntity.ok(Map.of(
            "likesCount", newCount,
            "entityType", entityType.toUpperCase(),
            "entityId",   entityId
        ));
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
