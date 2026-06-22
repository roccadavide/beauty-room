package daviderocca.beautyroom.entities;

import daviderocca.beautyroom.enums.PackageCreditStatus;
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
@ToString(exclude = {"service", "serviceOption", "user", "customer"})
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

    /** purchasedAt + 24 mesi — impostato automaticamente in @PrePersist */
    @Column(name="expiry_date", nullable=false)
    private LocalDateTime expiryDate;

    @Column(name="stripe_session_id", length=120)
    private String stripeSessionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name="service_id", nullable=false)
    private ServiceItem service;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name="service_option_id", nullable=false)
    private ServiceOption serviceOption;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="user_id")
    private User user;

    /**
     * Stable owner of this credit (V74). Set at purchase from the resolved buyer Customer so a paid
     * credit keeps its owner even when its last booking is detached. Nullable: existing rows and
     * admin-assigned credits have none. Mirrors {@code Booking.customer} — ON DELETE SET NULL,
     * no cascade (Hibernate only writes the FK from the associated id).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="customer_id")
    private Customer customer;

    @PrePersist
    protected void onCreate() {
        this.purchasedAt = LocalDateTime.now();
        this.expiryDate  = this.purchasedAt.plusMonths(24);
    }
}