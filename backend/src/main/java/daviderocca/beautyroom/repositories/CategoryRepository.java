package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CategoryRepository extends JpaRepository<Category, UUID> {

    Optional<Category> findByCategoryKey(String categoryKey);
    Optional<Category> findByLabel(String label);

}
