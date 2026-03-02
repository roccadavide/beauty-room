package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.Result;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResultRepository extends JpaRepository<Result, UUID> {

    boolean existsByTitle(String title);

    boolean existsByTitleAndResultIdNot(String title, UUID resultId);

    @EntityGraph(attributePaths = {"images", "category"})
    @Query("select r from Result r where r.resultId = :id")
    Optional<Result> findByIdWithDetails(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"images", "category"})
    @Query("select r from Result r")
    Page<Result> findAllWithDetails(Pageable pageable);
}
