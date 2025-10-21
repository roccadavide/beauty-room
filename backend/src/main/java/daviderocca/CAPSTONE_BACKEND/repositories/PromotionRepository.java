package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, UUID> {
    @Query("""
       SELECT p FROM Promotion p
       WHERE p.active = true
         AND (p.startDate IS NULL OR p.startDate <= :today)
         AND (p.endDate IS NULL OR p.endDate >= :today)
       ORDER BY p.priority DESC
       """)
    List<Promotion> findActive(@Param("today") LocalDate today);
}