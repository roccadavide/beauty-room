package daviderocca.beautyroom.entities;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "booking_sales")
@Getter @Setter @NoArgsConstructor
public class BookingSale {

    @Id @GeneratedValue
    private UUID id;

    @Column(name = "booking_id", nullable = false)
    private UUID bookingId;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    @Column(nullable = false)
    private int quantity = 1;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "added_at", nullable = false, updatable = false)
    private LocalDateTime addedAt;

    // V65 (08.1): when set, tags this sale as a product line of a promotion link
    // (booking_promotion_link.id). NULL = standalone free sale (unchanged behavior,
    // moves no stock). Plain UUID, mirroring bookingId/productId — NOT a JPA relationship.
    @Column(name = "promotion_link_id")
    private UUID promotionLinkId;

    // V65 (08.1): frozen pre-discount unit price, for the struck-through display on
    // promo products. NULL on free sales (unit_price is already the full price there).
    @Column(name = "original_unit_price", precision = 10, scale = 2)
    private BigDecimal originalUnitPrice;

    // Block B: per-line paid flag for standalone product sales (drawer + quick-add).
    // Promo product-lines ignore this (their paid lives on booking_promotion_link).
    @Column(nullable = false)
    private boolean paid = false;

    // V83 (multi-staff prompt 01): sale inherits its booking's staff (R9). Stays
    // nullable by design — NULL = unattributed.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id")
    private daviderocca.beautyroom.staff.StaffMember staffMember;

    @PrePersist
    void onCreate() {
        addedAt = LocalDateTime.now();
    }
}
