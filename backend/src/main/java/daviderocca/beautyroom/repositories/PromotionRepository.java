package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.Promotion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    List<Promotion> findByActiveTrue();

    @Query("""
       SELECT p FROM Promotion p
       WHERE p.active = true
         AND (p.startDate IS NULL OR p.startDate <= :today)
         AND (p.endDate IS NULL OR p.endDate >= :today)
       ORDER BY p.priority DESC
       """)
    List<Promotion> findActive(@Param("today") LocalDate today);

    @EntityGraph(attributePaths = {"products", "services", "categories"})
    @Query("select p from Promotion p where p.promotionId = :id")
    Optional<Promotion> findByIdWithDetails(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"products", "services", "categories"})
    @Query("select p from Promotion p")
    Page<Promotion> findAllWithDetails(Pageable pageable);

    @EntityGraph(attributePaths = {"products", "services", "categories"})
    @Query("select p from Promotion p where p.active = true")
    Page<Promotion> findAllActiveWithDetails(Pageable pageable);

    @EntityGraph(attributePaths = {"products", "services", "categories"})
    @Query("""
       SELECT p FROM Promotion p
       WHERE p.active = true
         AND (p.startDate IS NULL OR p.startDate <= :today)
         AND (p.endDate IS NULL OR p.endDate >= :today)
       ORDER BY p.priority DESC
       """)
    List<Promotion> findActiveWithDetails(@Param("today") LocalDate today);
}