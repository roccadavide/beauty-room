package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "order_items")
@NoArgsConstructor
@Getter
@Setter
@ToString(exclude = {"product", "order"})
public class OrderItem {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "order_item_id", updatable = false, nullable = false)
    private UUID orderItemId;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    public OrderItem(int quantity, BigDecimal price, Product product, Order order) {
        this.quantity = quantity;
        this.price = price;
        this.product = product;
        this.order = order;
    }
}