package daviderocca.CAPSTONE_BACKEND.entities;

import daviderocca.CAPSTONE_BACKEND.enums.PackageCreditStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "package_credits",
        indexes = {
                @Index(name="idx_pkg_email", columnList="customer_email"),
                @Index(name="idx_pkg_status", columnList="status"),
                @Index(name="idx_pkg_service", columnList="service_id"),
                @Index(name="idx_pkg_option", columnList="service_option_id")
        }
)
@NoArgsConstructor
@Getter
@Setter
@ToString(exclude = {"service", "serviceOption", "user"})
public class PackageCredit {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "package_credit_id", updatable = false, nullable = false)
    private UUID packageCreditId;

    @Column(name="customer_email", nullable=false, length=100)
    private String customerEmail;

    @Column(name="sessions_total", nullable=false)
    private int sessionsTotal;

    @Column(name="sessions_remaining", nullable=false)
    private int sessionsRemaining;

    @Enumerated(EnumType.STRING)
    @Column(name="status", nullable=false, length=20)
    private PackageCreditStatus status = PackageCreditStatus.ACTIVE;

    @Column(name="purchased_at", nullable=false, updatable=false)
    private LocalDateTime purchasedAt;

    @Column(name="stripe_session_id", length=120)
    private String stripeSessionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name="service_id", nullable=false)
    private ServiceItem service;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="service_option_id")
    private ServiceOption serviceOption;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="user_id")
    private User user;

    @PrePersist
    protected void onCreate() {
        this.purchasedAt = LocalDateTime.now();
    }
}