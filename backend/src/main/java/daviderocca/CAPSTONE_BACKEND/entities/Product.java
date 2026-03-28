package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "products")
@NoArgsConstructor
@Getter
@Setter
@ToString(exclude = {"category", "orderItems"})
public class Product {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "product_id", updatable = false, nullable = false)
    private UUID productId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "short_description", length = 255)
    private String shortDescription;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "product_images", joinColumns = @JoinColumn(name = "product_id"))
    @Column(name = "image_url")
    private Set<String> images = new LinkedHashSet<>();

    @Version
    private Long version;

    @Column(nullable = false)
    private int stock;

    @Column(nullable = false)
    private boolean active = true;

    @ManyToMany(mappedBy = "products", fetch = FetchType.LAZY)
    private Set<Promotion> promotions = new HashSet<>();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @OneToMany(mappedBy = "product", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> orderItems;

    public Product(String name, BigDecimal price, String shortDescription, String description, List<String> images, int stock, Category category) {
        this.name = name;
        this.price = price;
        this.shortDescription = shortDescription;
        this.description = description;
        if (images != null) {
            this.images = new LinkedHashSet<>(images);
        }
        this.stock = stock;
        this.category = category;
    }
}