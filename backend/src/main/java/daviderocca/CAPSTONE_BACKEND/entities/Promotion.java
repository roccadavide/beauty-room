package daviderocca.CAPSTONE_BACKEND.entities;

import daviderocca.CAPSTONE_BACKEND.enums.DiscountType;
import daviderocca.CAPSTONE_BACKEND.enums.PromotionScope;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Entity
@Table(name = "promotions")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@ToString(exclude = {"services", "products", "categories"})
@Builder
public class Promotion {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "promotion_id", nullable = false, updatable = false)
    private UUID promotionId;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 255)
    private String subtitle;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "banner_image_url")
    private String bannerImageUrl;

    @Column(name = "card_image_url")
    private String cardImageUrl;

    @Column(name = "cta_label", length = 60)
    private String ctaLabel;

    @Column(name = "cta_link", length = 255)
    private String ctaLink;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", length = 20)
    private DiscountType discountType;

    @Column(name = "discount_value", precision = 10, scale = 2)
    private BigDecimal discountValue;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private PromotionScope scope = PromotionScope.GLOBAL;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "online_only")
    private boolean onlineOnly = false;

    @Column
    private int priority = 0;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "promotion_services",
            joinColumns = @JoinColumn(name = "promotion_id"),
            inverseJoinColumns = @JoinColumn(name = "service_id")
    )
    private List<ServiceItem> services = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "promotion_products",
            joinColumns = @JoinColumn(name = "promotion_id"),
            inverseJoinColumns = @JoinColumn(name = "product_id")
    )
    private List<Product> products = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "promotion_categories",
            joinColumns = @JoinColumn(name = "promotion_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    private List<Category> categories = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // ------------------------- METODI DI UTILITÀ -------------------------
    public boolean isCurrentlyActive() {
        LocalDate today = LocalDate.now();
        boolean dateOk = (startDate == null || !today.isBefore(startDate))
                && (endDate == null || !today.isAfter(endDate));
        return active && dateOk;
    }

    public boolean appliesToServices() {
        return !services.isEmpty();
    }

    public boolean appliesToProducts() {
        return !products.isEmpty();
    }

    public boolean appliesToCategories() {
        return !categories.isEmpty();
    }
}