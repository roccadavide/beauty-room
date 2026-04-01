package daviderocca.beautyroom.security;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TokenBlocklist {

    private final ConcurrentHashMap<String, Instant> blockedTokens = new ConcurrentHashMap<>();

    public void block(String jti, Instant expiry) {
        if (jti == null || jti.isBlank() || expiry == null) {
            return;
        }
        blockedTokens.put(jti, expiry);
    }

    public boolean isBlocked(String jti) {
        if (jti == null || jti.isBlank()) {
            return false;
        }
        Instant expiry = blockedTokens.get(jti);
        if (expiry == null) return false;
        if (Instant.now().isAfter(expiry)) {
            blockedTokens.remove(jti);
            return false;
        }
        return true;
    }

    @Scheduled(fixedDelay = 3600000)
    public void cleanup() {
        Instant now = Instant.now();
        blockedTokens.entrySet().removeIf(e -> now.isAfter(e.getValue()));
    }
}
