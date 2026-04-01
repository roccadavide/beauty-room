package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.Result;
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
public interface ResultRepository extends JpaRepository<Result, UUID> {

    List<Result> findByActiveTrue();

    boolean existsByTitle(String title);

    boolean existsByTitleAndResultIdNot(String title, UUID resultId);

    @EntityGraph(attributePaths = {"images", "category", "linkedService"})
    @Query("select r from Result r where r.resultId = :id")
    Optional<Result> findByIdWithDetails(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"images", "category", "linkedService"})
    @Query("select r from Result r")
    Page<Result> findAllWithDetails(Pageable pageable);

    @EntityGraph(attributePaths = {"images", "category", "linkedService"})
    @Query("select r from Result r where r.active = true")
    Page<Result> findAllActiveWithDetails(Pageable pageable);
}
