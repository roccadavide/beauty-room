package daviderocca.beautyroom.promotions;

import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One snapshotted SERVICE line of a {@link BookingPromotionLink}.
 *
 * Names and prices are frozen copies taken at attach time. The {@code service} /
 * {@code serviceOption} FKs are kept only for traceability and are nullable — they
 * survive the catalog row being deleted (DB-side ON DELETE SET NULL), while the
 * snapshot fields keep the line renderable and chargeable.
 *
 * Owning side of the parent's {@code @OneToMany} (mirrors ClientPackageAssignmentItem).
 */
@Entity
@Table(name = "booking_promotion_link_item")
@Getter
@Setter
@NoArgsConstructor
public class BookingPromotionLinkItem {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "promotion_link_id", nullable = false)
    private BookingPromotionLink promotionLink;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private ServiceItem service;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_option_id")
    private ServiceOption serviceOption;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "name_snapshot", nullable = false, length = 255)
    private String nameSnapshot;

    @Column(name = "original_price_snapshot", nullable = false, precision = 10, scale = 2)
    private BigDecimal originalPriceSnapshot;

    @Column(name = "discounted_price_snapshot", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountedPriceSnapshot;

    @Column(name = "duration_min_snapshot")
    private Integer durationMinSnapshot;
}
