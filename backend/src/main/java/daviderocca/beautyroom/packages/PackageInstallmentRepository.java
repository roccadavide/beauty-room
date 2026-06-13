package daviderocca.beautyroom.packages;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PackageInstallmentRepository extends JpaRepository<PackageInstallment, UUID> {

    List<PackageInstallment> findByAssignmentIdOrderByPositionAscDueDateAsc(UUID assignmentId);
}
