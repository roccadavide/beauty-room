package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.PackageCredit;
import daviderocca.CAPSTONE_BACKEND.enums.PackageCreditStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PackageCreditRepository extends JpaRepository<PackageCredit, UUID> {

    List<PackageCredit> findByCustomerEmailIgnoreCaseAndStatusOrderByPurchasedAtDesc(
            String email,
            PackageCreditStatus status
    );

    Optional<PackageCredit> findByStripeSessionId(String stripeSessionId);
}