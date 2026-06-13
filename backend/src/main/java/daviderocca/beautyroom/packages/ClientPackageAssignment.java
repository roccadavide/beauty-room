package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.ClientPackagePaymentMode;
import daviderocca.beautyroom.enums.ClientPackageStatus;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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
     * Kept post-composition as a backward-compatible "representative" for the package
     * (mirrors item position=0); items[] is the source of truth for the UI.
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

    /**
     * Optional override applied to every session of this package.
     * Phase-1 storage only — not yet read by booking duration calculation.
     */
    @Column(name = "session_duration_min")
    private Integer sessionDurationMin;

    @Column(name = "paid_upfront", nullable = false)
    private boolean paidUpfront = false;

    /**
     * How the package is settled (PER_SESSION / UPFRONT / INSTALLMENTS).
     * Kept in sync with the legacy paidUpfront flag by ClientPackageService so
     * existing readers (buildPackageSummary, etc.) keep working unchanged.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", nullable = false, length = 20)
    private ClientPackagePaymentMode paymentMode = ClientPackagePaymentMode.PER_SESSION;

    /**
     * Starting session number for packages already mid-course at launch.
     * Phase-1 storage only — recalculatePackageSessions still anchors on
     * BookingPackageLink.sessionNumber.
     */
    @Column(name = "start_session", nullable = false)
    private int startSession = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Composition items (1..N descriptive lines).
     * Setter suppressed so the collection reference stays Hibernate-managed —
     * use addItem / clearItems / replaceItems to mutate.
     */
    @Setter(AccessLevel.NONE)
    @OneToMany(mappedBy = "assignment", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    private List<ClientPackageAssignmentItem> items = new ArrayList<>();

    public void addItem(ClientPackageAssignmentItem item) {
        item.setAssignment(this);
        this.items.add(item);
    }

    public void clearItems() {
        for (ClientPackageAssignmentItem i : this.items) {
            i.setAssignment(null);
        }
        this.items.clear();
    }

    public void replaceItems(List<ClientPackageAssignmentItem> newItems) {
        clearItems();
        if (newItems != null) {
            for (ClientPackageAssignmentItem i : newItems) {
                addItem(i);
            }
        }
    }

    /**
     * Installment registry (0..N recorded payments).
     * Setter suppressed so the collection reference stays Hibernate-managed —
     * CRUD goes through PackageInstallmentRepository; the collection exists for
     * read + cascade-on-delete. Mirrors the items[] pattern above.
     */
    @Setter(AccessLevel.NONE)
    @OneToMany(mappedBy = "assignment", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    private List<PackageInstallment> installments = new ArrayList<>();

    public void addInstallment(PackageInstallment installment) {
        installment.setAssignment(this);
        this.installments.add(installment);
    }

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
