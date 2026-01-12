package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.Closure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ClosureRepository extends JpaRepository<Closure, UUID> {

    List<Closure> findByDate(LocalDate date);

    @Query("""
      SELECT c FROM Closure c
      WHERE c.date = :date
        AND c.id <> :excludeId
    """)
    List<Closure> findByDateExcluding(@Param("date") LocalDate date,
                                      @Param("excludeId") UUID excludeId);

    @Query("""
      SELECT c FROM Closure c
      WHERE c.date >= :from AND c.date < :to
      ORDER BY c.date ASC, c.startTime ASC
    """)
    List<Closure> findByDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);
}