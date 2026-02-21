package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "processed_stripe_events")
@NoArgsConstructor
@Getter
public class ProcessedStripeEvent {

    @Id
    @Column(name = "event_id", length = 64)
    private String eventId;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    public ProcessedStripeEvent(String eventId) {
        this.eventId = eventId;
        this.processedAt = Instant.now();
    }
}
