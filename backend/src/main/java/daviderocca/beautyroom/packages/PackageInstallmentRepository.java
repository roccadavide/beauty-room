package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.enums.ClientPackageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface PackageInstallmentRepository extends JpaRepository<PackageInstallment, UUID> {

    List<PackageInstallment> findByAssignmentIdOrderByPositionAscDueDateAsc(UUID assignmentId);

    /**
     * Paid installments across a set of packages, batched so "collected" can be
     * summed per assignment in Java without an N+1 (Phase 2b "due" enrichment).
     * Derives {@code assignment.id IN (...) AND paid = true}.
     */
    List<PackageInstallment> findByAssignmentIdInAndPaidTrue(Collection<UUID> assignmentIds);

    /**
     * Cross-package feed of UNPAID installments due in [from, to], excluding
     * installments of CANCELLED assignments. Fetch-joins the parent assignment and
     * its nullable service so the DTO mapping reads clientName / service title in a
     * single SQL statement (no N+1).
     */
    @Query("""
            select pi from PackageInstallment pi
            join fetch pi.assignment a
            left join fetch a.service s
            where pi.paid = false
              and pi.dueDate between :from and :to
              and a.status <> :excludedStatus
            order by pi.dueDate asc, a.clientName asc
            """)
    List<PackageInstallment> findUnpaidDueBetween(@Param("from") LocalDate from,
                                                  @Param("to") LocalDate to,
                                                  @Param("excludedStatus") ClientPackageStatus excludedStatus);
}
