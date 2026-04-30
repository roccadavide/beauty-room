package daviderocca.beautyroom.likes;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "likes",
    indexes = {
        @Index(name = "idx_likes_entity",     columnList = "entity_type, entity_id"),
        @Index(name = "idx_likes_rate_limit", columnList = "entity_type, entity_id, ip_hash, created_at")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Like {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entity_type", nullable = false, length = 20)
    private String entityType;   // "SERVICE" | "PRODUCT" | "RESULT"

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(name = "ip_hash", nullable = false, length = 64)
    private String ipHash;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
