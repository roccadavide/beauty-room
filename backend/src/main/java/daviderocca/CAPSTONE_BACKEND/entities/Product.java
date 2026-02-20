package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
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
    private List<String> images;

    @Version
    private Long version;

    @Column(nullable = false)
    private int stock;

    @ManyToMany(mappedBy = "products", fetch = FetchType.LAZY)
    private List<Promotion> promotions = new ArrayList<>();

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
        this.images = images;
        this.stock = stock;
        this.category = category;
    }
}