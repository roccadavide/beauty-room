package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.ServiceItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ServiceItemRepository extends JpaRepository<ServiceItem, UUID> {

    List<ServiceItem> findByActiveTrue();

    long countByFeaturedTrue();

    boolean existsByTitle(String title);

    boolean existsByTitleAndActiveTrue(String title);

    boolean existsByTitleAndServiceIdNot(String title, UUID serviceItemId);

    @EntityGraph(attributePaths = {"options", "category", "images"})
    @Query("select s from ServiceItem s where s.serviceId = :id")
    Optional<ServiceItem> findByIdWithDetails(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"options", "category", "images"})
    @Query("select s from ServiceItem s")
    Page<ServiceItem> findAllWithDetails(Pageable pageable);

    @EntityGraph(attributePaths = {"options", "category", "images"})
    @Query("select s from ServiceItem s where s.active = true")
    Page<ServiceItem> findAllActiveWithDetails(Pageable pageable);

    @Modifying
    @Query("UPDATE ServiceItem s SET s.likesCount = s.likesCount + 1 WHERE s.serviceId = :id")
    void incrementLikes(@Param("id") UUID id);

    @Modifying
    @Query("UPDATE ServiceItem s SET s.likesCount = GREATEST(s.likesCount - 1, 0) WHERE s.serviceId = :id")
    void decrementLikes(@Param("id") UUID id);
}
