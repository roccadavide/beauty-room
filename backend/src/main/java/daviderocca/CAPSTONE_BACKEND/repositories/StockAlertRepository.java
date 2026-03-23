package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.StockAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StockAlertRepository extends JpaRepository<StockAlert, UUID> {

    List<StockAlert> findByProductIdAndNotifiedAtIsNull(UUID productId);

    boolean existsByProductIdAndEmailIgnoreCase(UUID productId, String email);
}
