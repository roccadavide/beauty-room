package daviderocca.beautyroom.entities;

import daviderocca.beautyroom.enums.NotificationType;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "admin_notifications",
    indexes = {
        @Index(name = "idx_notif_unread",  columnList = "read_at"),
        @Index(name = "idx_notif_created", columnList = "created_at")
    }
)
@Getter @Setter @NoArgsConstructor
public class AdminNotification {

    @Id @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private NotificationType type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 500)
    private String body;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(name = "entity_type", length = 50)
    private String entityType;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { this.createdAt = LocalDateTime.now(); }

    public boolean isRead() { return readAt != null; }
}
