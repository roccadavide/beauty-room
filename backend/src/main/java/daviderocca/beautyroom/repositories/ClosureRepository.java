package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.Closure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ClosureRepository extends JpaRepository<Closure, UUID> {

    // ---- Legacy single-date lookups (kept for back-compat; new code uses range-based)
    List<Closure> findByDate(LocalDate date);

    @Query("""
      SELECT c FROM Closure c
      WHERE c.date = :date
        AND c.id <> :excludeId
    """)
    List<Closure> findByDateExcluding(@Param("date") LocalDate date,
                                      @Param("excludeId") UUID excludeId);

    // ---- Range-aware lookups (multi-day closures stored on one row)

    /**
     * Returns all closures whose [startDate, endDate] range covers the given day.
     * Multi-day closures stored on one row are returned for every day they span.
     */
    @Query("""
      SELECT c FROM Closure c
      WHERE c.startDate <= :day AND c.endDate >= :day
      ORDER BY c.startDate ASC, c.startTime ASC
    """)
    List<Closure> findOverlappingDate(@Param("day") LocalDate day);

    @Query("""
      SELECT c FROM Closure c
      WHERE c.startDate <= :day AND c.endDate >= :day
        AND c.id <> :excludeId
      ORDER BY c.startDate ASC, c.startTime ASC
    """)
    List<Closure> findOverlappingDateExcluding(@Param("day") LocalDate day,
                                               @Param("excludeId") UUID excludeId);

    /**
     * Returns all closures intersecting the half-open range [from, toExclusive).
     * A closure intersects when its [startDate, endDate] overlaps the range.
     */
    @Query("""
      SELECT c FROM Closure c
      WHERE c.startDate < :toExclusive AND c.endDate >= :from
      ORDER BY c.startDate ASC, c.startTime ASC
    """)
    List<Closure> findByDateRange(@Param("from") LocalDate from,
                                  @Param("toExclusive") LocalDate toExclusive);

    /**
     * Closures whose startDate matches the given day exactly (reminder scheduler).
     */
    List<Closure> findByStartDate(LocalDate startDate);
}
