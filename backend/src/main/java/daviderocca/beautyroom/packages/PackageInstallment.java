package daviderocca.beautyroom.packages;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One recorded payment toward a ClientPackageAssignment (the installment registry).
 * UPFRONT packages have a single paid installment for the full amount; INSTALLMENTS
 * packages have arbitrary amounts on arbitrary dates. Money lives here — the parent
 * assignment owns pricePaid (the agreed gross total), never per-item.
 *
 * Mirrors the ClientPackageAssignment idioms (UUID @GeneratedValue id, lifecycle hooks).
 */
@Entity
@Table(name = "package_installments")
@Getter
@Setter
@NoArgsConstructor
public class PackageInstallment {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_package_assignment_id", nullable = false)
    private ClientPackageAssignment assignment;

    @Column(name = "amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "paid", nullable = false)
    private boolean paid = false;

    @Column(name = "paid_date")
    private LocalDate paidDate;

    @Column(name = "payment_method", length = 20)
    private String paymentMethod;

    @Column(name = "note", length = 255)
    private String note;

    @Column(name = "position", nullable = false)
    private int position;

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
