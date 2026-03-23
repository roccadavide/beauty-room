package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "stock_alerts",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_stock_alert_product_email",
        columnNames = {"product_id", "email"}
    )
)
@Getter @Setter @NoArgsConstructor
public class StockAlert {

    @Id @GeneratedValue
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(nullable = false, length = 120)
    private String email;

    @Column(name = "customer_name", length = 120)
    private String customerName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "notified_at")
    private LocalDateTime notifiedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
