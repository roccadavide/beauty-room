package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.enums.PackageCreditStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PackageCreditRepository extends JpaRepository<PackageCredit, UUID> {

    // ---- storico per email (singolo status) ----
    List<PackageCredit> findByCustomerEmailIgnoreCaseAndStatusOrderByPurchasedAtDesc(
            String email,
            PackageCreditStatus status
    );

    // ---- storico completo per email (tutti gli status, per client area e admin) ----
    @Query("""
            SELECT pc FROM PackageCredit pc
            LEFT JOIN FETCH pc.service
            LEFT JOIN FETCH pc.serviceOption
            WHERE LOWER(pc.customerEmail) = LOWER(:email)
            ORDER BY pc.purchasedAt DESC
            """)
    List<PackageCredit> findAllByCustomerEmailOrderByPurchasedAtDesc(@Param("email") String email);

    // ---- blocco pessimistico su singolo pacchetto (anti race-condition) ----
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PackageCredit p WHERE p.packageCreditId = :id")
    Optional<PackageCredit> findByIdForUpdate(@Param("id") UUID id);

    // ---- verifica duplicato attivo per stessa serviceOption + email ----
    boolean existsByCustomerEmailIgnoreCaseAndServiceOptionOptionIdAndStatus(
            String customerEmail,
            UUID optionId,
            PackageCreditStatus status
    );

    // ---- FIFO: prende il più vecchio ACTIVE per email + option (regola 8) ----
    Optional<PackageCredit> findTopByCustomerEmailIgnoreCaseAndServiceOptionOptionIdAndStatusOrderByPurchasedAtAsc(
            String customerEmail,
            UUID optionId,
            PackageCreditStatus status
    );

    // ---- scheduler scadenza: tutti ACTIVE con expiryDate passata ----
    List<PackageCredit> findByStatusAndExpiryDateBefore(
            PackageCreditStatus status,
            LocalDateTime cutoff
    );

    /**
     * Returns all active packages for a customer email.
     * Used by CustomerService.getSummary to populate the packages panel.
     */
    List<PackageCredit> findByCustomerEmailAndStatus(
            String customerEmail,
            PackageCreditStatus status
    );

    /**
     * Bridge: a customer's online packages of the given status, resolved directly through the
     * credit's own owner FK (package_credits.customer_id, V74 — forward-filled at purchase,
     * backfilled for existing unambiguous rows). Keying on customer_id instead of the customer's
     * bookings means a credit that has been detached from every booking but is still paid + ACTIVE
     * stays visible, and shared-email collision is structurally impossible (the FK is per-customer).
     * service/serviceOption are fetched eagerly because OSIV is off and the caller maps them into
     * the DTO after the tx closes. Credits with a null customer_id (admin-assigned / un-backfilled)
     * never match here and surface only in the admin global view.
     */
    @Query("""
            SELECT DISTINCT pc FROM PackageCredit pc
            LEFT JOIN FETCH pc.service
            LEFT JOIN FETCH pc.serviceOption
            WHERE pc.status = :status
              AND pc.customer.customerId = :customerId
            """)
    List<PackageCredit> findActiveOnlineByCustomerId(
            @Param("customerId") UUID customerId,
            @Param("status") PackageCreditStatus status
    );

    // ---- lookup stripe (idempotenza webhook) ----
    Optional<PackageCredit> findByStripeSessionId(String stripeSessionId);

    // ---- vista admin: tutti i pacchetti per status, ordinati per scadenza ----
    @Query("""
            SELECT pc FROM PackageCredit pc
            LEFT JOIN FETCH pc.service
            LEFT JOIN FETCH pc.serviceOption
            LEFT JOIN FETCH pc.user
            WHERE pc.status IN :statuses
            ORDER BY pc.expiryDate ASC
            """)
    List<PackageCredit> findAllByStatusInOrderByExpiryDateAsc(
            @Param("statuses") List<PackageCreditStatus> statuses
    );

    // ---- KPI: conta per status ----
    long countByStatus(PackageCreditStatus status);
}