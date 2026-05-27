package daviderocca.beautyroom.services;

import daviderocca.beautyroom.entities.RefreshToken;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.exceptions.UnauthorizedException;
import daviderocca.beautyroom.repositories.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    private final RefreshTokenRepository repo;

    @Value("${app.jwt.refresh-expiration-ms:1209600000}")
    private long refreshExpirationMs;

    @Value("${app.jwt.refresh-pepper:beauty-room-pepper-2026}")
    private String pepper;

    private static final SecureRandom RANDOM = new SecureRandom();

    // Grace window: if a refresh token marked "used" arrives again within this delta
    // AND its replacement child is still valid, we re-issue a new access token without
    // rotating the cookie. Prevents false-positive reuse-detection on legitimate races
    // (multi-tab, HTTP retry, request retransmit). See rotate() below.
    private static final long REFRESH_GRACE_WINDOW_MS = 30_000L;

    // -------------------- CREATE --------------------

    @Transactional
    public RawAndEntity create(User user, String userAgent, String ip) {
        String rawToken = generateRawToken();
        String hash = hash(rawToken);

        Instant expiresAt = Instant.now().plusMillis(refreshExpirationMs);
        RefreshToken entity = new RefreshToken(user, hash, expiresAt, null, userAgent, ip);
        repo.save(entity);

        log.info("Refresh token created for user={}", user.getEmail());
        return new RawAndEntity(rawToken, entity);
    }

    // -------------------- ROTATE --------------------

    @Transactional
    public RotateResult rotate(String incomingRawToken, String userAgent, String ip) {
        String incomingHash = hash(incomingRawToken);
        RefreshToken existing = repo.findByTokenHash(incomingHash)
                .orElseThrow(() -> new UnauthorizedException("Refresh token non valido."));

        if (existing.isRevoked() && !existing.isUsed()) {
            // Explicitly revoked (not just marked "used" as part of rotation)
            throw new UnauthorizedException("Refresh token scaduto o revocato.");
        }
        if (existing.isExpired()) {
            throw new UnauthorizedException("Refresh token scaduto o revocato.");
        }

        // REUSE DETECTION with grace window.
        // When rotate() marks a token "used", it sets both replacedByHash and revokedAt to the
        // rotation instant — so revokedAt doubles as the "usedAt" timestamp here.
        // Grace-period contract: if the same token is replayed within REFRESH_GRACE_WINDOW_MS
        // AND its replacement child is still fully valid, we treat the replay as a benign
        // race (multi-tab, retry, retransmit) and return a fresh access token without rotating
        // the refresh cookie. The caller (AuthController) must skip Set-Cookie when graceHit
        // is true so the client keeps using its already-issued child cookie.
        if (existing.isUsed()) {
            Instant usedAt = existing.getRevokedAt();
            long deltaMs = usedAt == null ? Long.MAX_VALUE : (Instant.now().toEpochMilli() - usedAt.toEpochMilli());

            if (deltaMs < REFRESH_GRACE_WINDOW_MS) {
                RefreshToken child = repo.findByTokenHash(existing.getReplacedByHash()).orElse(null);
                if (child != null && !child.isRevoked() && !child.isExpired() && !child.isUsed()) {
                    log.info("refresh-grace-hit user={} delta={}ms", existing.getUser().getEmail(), deltaMs);
                    return new RotateResult(null, child, existing.getUser(), true);
                }
            }

            log.warn("REUSE DETECTED for user={} tokenId={} — revoking all tokens", existing.getUser().getEmail(), existing.getId());
            revokeAllForUser(existing.getUser().getUserId());
            throw new UnauthorizedException("Rilevato riutilizzo token. Effettua nuovamente il login.");
        }

        // Generate new token
        String newRaw = generateRawToken();
        String newHash = hash(newRaw);

        // Mark old as used
        existing.setReplacedByHash(newHash);
        existing.setRevokedAt(Instant.now());

        // Save new token with parent chain
        Instant expiresAt = Instant.now().plusMillis(refreshExpirationMs);
        RefreshToken newEntity = new RefreshToken(existing.getUser(), newHash, expiresAt, incomingHash, userAgent, ip);
        repo.save(newEntity);

        log.info("Refresh token rotated for user={}", existing.getUser().getEmail());
        return new RotateResult(newRaw, newEntity, existing.getUser(), false);
    }

    // -------------------- REVOKE --------------------

    @Transactional
    public void revoke(String rawToken) {
        String h = hash(rawToken);
        repo.findByTokenHash(h).ifPresent(rt -> {
            log.info("Deleting refresh token for user={}", rt.getUser().getEmail());
            repo.delete(rt);
            repo.flush();
        });
    }

    @Transactional
    public void revokeAllForUser(UUID userId) {
        int count = repo.revokeAllByUser(userId, Instant.now());
        log.info("Revoked {} refresh tokens for userId={}", count, userId);
    }

    // -------------------- VALIDATE (read-only) --------------------

    @Transactional(readOnly = true)
    public User validateAndGetUser(String rawToken) {
        String h = hash(rawToken);
        RefreshToken rt = repo.findByTokenHash(h)
                .orElseThrow(() -> new UnauthorizedException("Refresh token non valido."));

        if (rt.isRevoked() || rt.isExpired() || rt.isUsed()) {
            throw new UnauthorizedException("Refresh token scaduto o revocato.");
        }
        return rt.getUser();
    }

    // -------------------- CLEANUP --------------------

    @Transactional
    public int deleteExpired() {
        return repo.deleteExpiredBefore(Instant.now());
    }

    // -------------------- HASHING --------------------

    String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] peppered = (rawToken + pepper).getBytes(StandardCharsets.UTF_8);
            byte[] hashed = digest.digest(peppered);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String generateRawToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    // -------------------- DTO --------------------

    public record RawAndEntity(String rawToken, RefreshToken entity) {}

    // Result of rotate(): when graceHit is true, rawToken is null and AuthController must
    // skip Set-Cookie (the client keeps using the child cookie issued by the prior rotation).
    public record RotateResult(String rawToken, RefreshToken entity, User user, boolean graceHit) {}
}
