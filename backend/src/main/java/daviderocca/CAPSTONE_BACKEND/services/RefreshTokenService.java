package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.entities.RefreshToken;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.repositories.RefreshTokenRepository;
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
    public RawAndEntity rotate(String incomingRawToken, String userAgent, String ip) {
        String incomingHash = hash(incomingRawToken);
        RefreshToken existing = repo.findByTokenHash(incomingHash)
                .orElseThrow(() -> new UnauthorizedException("Refresh token non valido."));

        if (existing.isRevoked() || existing.isExpired()) {
            throw new UnauthorizedException("Refresh token scaduto o revocato.");
        }

        // REUSE DETECTION: token already used (rotated), but someone is presenting it again
        if (existing.isUsed()) {
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
        return new RawAndEntity(newRaw, newEntity);
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
}
