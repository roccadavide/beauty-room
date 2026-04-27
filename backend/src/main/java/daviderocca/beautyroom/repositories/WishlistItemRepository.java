package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.WishlistItem;
import daviderocca.beautyroom.enums.WishlistItemType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, UUID> {

    List<WishlistItem> findByUser_UserIdOrderByCreatedAtDesc(UUID userId);

    Optional<WishlistItem> findByUser_UserIdAndItemTypeAndItemId(UUID userId, WishlistItemType type, UUID itemId);

    boolean existsByUser_UserIdAndItemTypeAndItemId(UUID userId, WishlistItemType type, UUID itemId);

    List<WishlistItem> findByItemTypeAndItemId(WishlistItemType type, UUID itemId);

    void deleteByItemTypeAndItemId(WishlistItemType type, UUID itemId);

    long countByItemTypeAndItemId(WishlistItemType type, UUID itemId);

    @Query("""
        SELECT w.itemType AS itemType, w.itemId AS itemId, COUNT(w) AS count
        FROM WishlistItem w
        GROUP BY w.itemType, w.itemId
        ORDER BY COUNT(w) DESC
    """)
    List<Object[]> countGroupedByTypeAndItem();
}
