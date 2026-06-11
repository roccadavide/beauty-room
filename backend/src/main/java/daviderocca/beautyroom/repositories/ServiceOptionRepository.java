package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.ServiceOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ServiceOptionRepository extends JpaRepository<ServiceOption, UUID> {
    List<ServiceOption> findByService_ServiceId(UUID serviceId);

    // Fix 11: load an option only if it belongs to the given service. Filters on the FK column
    // (no JOIN, no lazy load of the option's service) so it is safe to call from a non-transactional
    // controller with OSIV disabled. Empty ⇒ option missing OR not owned by that service.
    Optional<ServiceOption> findByOptionIdAndService_ServiceId(UUID optionId, UUID serviceId);

    @Query("""
            SELECT so FROM ServiceOption so
            JOIN FETCH so.service si
            WHERE so.isPackage = true
            AND so.active = true
            AND si.active = true
            ORDER BY si.title ASC, so.sessions ASC
            """)
    List<ServiceOption> findActivePackages();

    @Query("""
            SELECT so FROM ServiceOption so
            JOIN FETCH so.service si
            WHERE so.isPackage = true
            ORDER BY si.active DESC, si.title ASC, so.active DESC, so.sessions ASC
            """)
    List<ServiceOption> findAllPackages();
}