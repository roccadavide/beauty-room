package daviderocca.beautyroom.promotions;

import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Promotion;
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
 * Links one booking to one promotion, with a FROZEN SNAPSHOT of the promotion's
 * contents and prices at attach time.
 *
 * The snapshot is authoritative for display and pricing — the live {@code promotion}
 * FK is kept only for traceability/reporting and is nullable, so the link survives the
 * promotion being edited, archived or deleted (DB-side ON DELETE SET NULL). If the
 * promotion later changes, this appointment keeps showing and charging exactly what was
 * agreed when it was created.
 *
 * Mirrors {@code BookingPackageLink} (parent link) + the
 * {@code ClientPackageAssignment -> ClientPackageAssignmentItem} relationship (items).
 * Each (booking, promotion) pair is unique — enforced by the join-table UNIQUE constraint.
 */
@Entity
@Table(
    name = "booking_promotion_link",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_booking_promo_link",
        columnNames = {"booking_id", "promotion_id"}
    )
)
@Getter
@Setter
@NoArgsConstructor
public class BookingPromotionLink {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    /** Live promotion — traceability only, nullable; survives promotion deletion. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "promotion_id")
    private Promotion promotion;

    @Column(name = "promotion_title_snapshot", nullable = false, length = 255)
    private String promotionTitleSnapshot;

    /**
     * Frozen copy of the promotion's DiscountType, stored as its plain name (not the
     * live enum) — a snapshot, not a managed reference, so NO {@code @Enumerated}.
     */
    @Column(name = "discount_type_snapshot", nullable = false, length = 20)
    private String discountTypeSnapshot;

    @Column(name = "discount_value_snapshot", precision = 10, scale = 2)
    private BigDecimal discountValueSnapshot;

    @Column(name = "total_original_snapshot", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalOriginalSnapshot;

    @Column(name = "total_discounted_snapshot", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalDiscountedSnapshot;

    /** Whether the promotion was currently active at attach time (snapshot). */
    @Column(name = "applied_while_active", nullable = false)
    private boolean appliedWhileActive;

    @Column(name = "paid", nullable = false)
    private boolean paid = false;

    /**
     * Snapshotted promo SERVICES, ordered. Setter suppressed so the collection
     * reference stays Hibernate-managed — use {@link #addItem} to mutate
     * (mirrors ClientPackageAssignment).
     */
    @Setter(AccessLevel.NONE)
    @OneToMany(mappedBy = "promotionLink", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    private List<BookingPromotionLinkItem> items = new ArrayList<>();

    @Column(name = "linked_at", nullable = false, updatable = false)
    private LocalDateTime linkedAt;

    public void addItem(BookingPromotionLinkItem it) {
        it.setPromotionLink(this);
        this.items.add(it);
    }

    @PrePersist
    void onCreate() {
        linkedAt = LocalDateTime.now();
    }
}
