package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
@NoArgsConstructor
@Getter
@Setter
public class RefreshToken {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true, length = 128)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "replaced_by_hash", length = 128)
    private String replacedByHash;

    @Column(name = "parent_hash", length = 128)
    private String parentHash;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @Column(name = "ip", columnDefinition = "TEXT")
    private String ip;

    public RefreshToken(User user, String tokenHash, Instant expiresAt, String parentHash, String userAgent, String ip) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
        this.parentHash = parentHash;
        this.userAgent = userAgent;
        this.ip = ip;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public boolean isUsed() {
        return replacedByHash != null;
    }
}
