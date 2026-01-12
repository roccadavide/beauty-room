package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.ServiceOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ServiceOptionRepository extends JpaRepository<ServiceOption, UUID> {
    List<ServiceOption> findByService_ServiceId(UUID serviceId);
}