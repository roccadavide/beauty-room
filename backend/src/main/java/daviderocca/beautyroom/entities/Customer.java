package daviderocca.beautyroom.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
        name = "customers",
        indexes = {
                @Index(name = "idx_customer_name_lower", columnList = "full_name"),
                @Index(name = "idx_customer_email_lower", columnList = "email")
        }
)
@NoArgsConstructor
@Getter
@Setter
@ToString(exclude = "bookings")
public class Customer {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "customer_id", updatable = false, nullable = false)
    private UUID customerId;

    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    @Column(name = "phone", length = 50)
    private String phone;

    /**
     * Digits-only normalization of {@link #phone}, used ONLY for deduplication /
     * lookup and the partial unique index {@code ux_customer_phone}. Never shown to
     * users — {@link #phone} stays human-readable for display. Kept in sync by
     * {@code CustomerService} via {@code PhoneNormalizer.normalize(...)}.
     */
    @Column(name = "phone_normalized", columnDefinition = "TEXT")
    private String phoneNormalized;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "customer", fetch = FetchType.LAZY)
    private List<Booking> bookings = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}