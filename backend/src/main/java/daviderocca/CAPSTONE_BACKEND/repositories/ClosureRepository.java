package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.Closure;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ClosureRepository extends JpaRepository<Closure, UUID> {
    List<Closure> findByDate(LocalDate date);
}