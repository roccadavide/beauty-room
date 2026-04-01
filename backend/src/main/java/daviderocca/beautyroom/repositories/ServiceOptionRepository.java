package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.ServiceOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface ServiceOptionRepository extends JpaRepository<ServiceOption, UUID> {
    List<ServiceOption> findByService_ServiceId(UUID serviceId);

    @Query("""
            SELECT so FROM ServiceOption so
            JOIN FETCH so.service si
            WHERE so.sessions > 1
            AND so.active = true
            AND si.active = true
            ORDER BY si.title ASC, so.sessions ASC
            """)
    List<ServiceOption> findActivePackages();
}