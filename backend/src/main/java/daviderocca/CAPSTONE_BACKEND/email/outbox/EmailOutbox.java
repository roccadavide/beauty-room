package daviderocca.CAPSTONE_BACKEND.email.outbox;

import daviderocca.CAPSTONE_BACKEND.email.events.EmailAggregateType;
import daviderocca.CAPSTONE_BACKEND.email.events.EmailEventType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "email_outbox",
        indexes = {
                @Index(name = "idx_email_outbox_status_sched", columnList = "status,scheduled_at"),
                @Index(name = "idx_email_outbox_agg", columnList = "aggregate_type,aggregate_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_email_event_agg",
                        columnNames = {"event_type", "aggregate_type", "aggregate_id"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
public class EmailOutbox {

    @Id
    @GeneratedValue
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 40)
    private EmailEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "aggregate_type", nullable = false, length = 20)
    private EmailAggregateType aggregateType;

    @Column(name = "aggregate_id", nullable = false)
    private UUID aggregateId;

    @Column(name = "to_email", nullable = false, length = 120)
    private String toEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private EmailOutboxStatus status = EmailOutboxStatus.PENDING;

    @Column(name = "attempts", nullable = false)
    private int attempts = 0;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "last_error", length = 800)
    private String lastError;

    @Column(name = "provider_message_id", length = 200)
    private String providerMessageId;

    @Column(name = "locked_at")
    private LocalDateTime lockedAt;

    @Column(name = "lock_owner", length = 80)
    private String lockOwner;

    @Version
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        if (scheduledAt == null) scheduledAt = createdAt;
    }
}