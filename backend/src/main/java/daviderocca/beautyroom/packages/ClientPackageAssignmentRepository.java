package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.enums.ClientPackageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ClientPackageAssignmentRepository extends JpaRepository<ClientPackageAssignment, UUID> {

    List<ClientPackageAssignment> findByLinkedUserUserIdOrderByCreatedAtDesc(UUID userId);

    List<ClientPackageAssignment> findByLinkedUserUserIdAndStatusOrderByCreatedAtDesc(
            UUID userId, ClientPackageStatus status);

    @Query("SELECT a FROM ClientPackageAssignment a WHERE LOWER(TRIM(a.clientName)) = LOWER(TRIM(:name)) ORDER BY a.createdAt DESC")
    List<ClientPackageAssignment> findByClientNameIgnoreCase(@Param("name") String name);
}
