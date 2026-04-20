package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.ProductOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProductOptionRepository extends JpaRepository<ProductOption, UUID> {

    List<ProductOption> findByProduct_ProductIdAndActiveTrue(UUID productId);

    void deleteByProduct_ProductId(UUID productId);
}
