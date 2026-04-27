package daviderocca.beautyroom.entities;

import daviderocca.beautyroom.enums.WishlistItemType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "wishlist_items",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wishlist_user_type_item",
                columnNames = {"user_id", "item_type", "item_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class WishlistItem {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 20)
    private WishlistItemType itemType;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public WishlistItem(User user, WishlistItemType itemType, UUID itemId) {
        this.user = user;
        this.itemType = itemType;
        this.itemId = itemId;
    }
}
