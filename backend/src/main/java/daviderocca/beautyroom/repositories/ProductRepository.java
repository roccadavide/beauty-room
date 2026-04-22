package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

    List<Product> findByActiveTrue();

    boolean existsByName(String name);

    boolean existsByNameAndActiveTrue(String name);

    boolean existsByNameAndProductIdNot(String name, UUID productId);

    @EntityGraph(attributePaths = {"images", "category"})
    @Query("select p from Product p where p.productId = :id")
    Optional<Product> findByIdWithDetails(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"images", "category", "orderItems"})
    @Query("select p from Product p where p.productId = :id")
    Optional<Product> findByIdWithDetailsAndOrderItems(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"images", "category"})
    @Query("select p from Product p")
    Page<Product> findAllWithDetails(Pageable pageable);

    @EntityGraph(attributePaths = {"images", "category"})
    @Query("select p from Product p where p.active = true")
    Page<Product> findAllActiveWithDetails(Pageable pageable);
}
