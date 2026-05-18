package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.ClientPackageStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Tracks an in-person package sold to a client by Michela.
 * Separate from PackageCredit (online Stripe purchases).
 */
@Entity
@Table(name = "client_package_assignments")
@Getter
@Setter
@NoArgsConstructor
public class ClientPackageAssignment {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "client_name", nullable = false, length = 255)
    private String clientName;

    /**
     * Direct reference to the catalog service. Independent of serviceOption,
     * so option-less services (e.g. Laminazione ciglia) can be associated with a package.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private ServiceItem service;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_option_id")
    private ServiceOption serviceOption;

    @Column(name = "custom_package_name", length = 255)
    private String customPackageName;

    @Column(name = "total_sessions", nullable = false)
    private int totalSessions;

    @Column(name = "sessions_remaining", nullable = false)
    private int sessionsRemaining;

    @Column(name = "price_paid", precision = 10, scale = 2)
    private BigDecimal pricePaid;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ClientPackageStatus status = ClientPackageStatus.ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_user_id")
    private User linkedUser;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
