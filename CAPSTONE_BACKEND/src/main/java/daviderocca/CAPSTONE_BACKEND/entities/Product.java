package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "products")
@NoArgsConstructor
@Getter
@Setter
public class Product {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "product_id")
    private UUID productId;

    private String name;

    private BigDecimal price;

    @Column(name = "short_description")
    private String shortDescription;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ElementCollection
    private List<String> images;

    private int stock;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    @OneToMany(mappedBy = "product")
    private List<OrderItem> orderItems;

    public Product(String name, BigDecimal price,String shortDescription, String description, List<String> images, int stock, Category category) {
        this.name = name;
        this.price = price;
        this.shortDescription = shortDescription;
        this.description = description;
        this.images = images;
        this.stock = stock;
        this.category = category;
    }

    @Override
    public String toString() {
        return "Product{" +
                "productId=" + productId +
                ", name='" + name + '\'' +
                ", price='" + price + '\'' +
                ", shortDescription='" + shortDescription + '\'' +
                ", description='" + description + '\'' +
                ", images=" + images +
                ", stock=" + stock +
                ", category=" + category +
                '}';
    }
}
