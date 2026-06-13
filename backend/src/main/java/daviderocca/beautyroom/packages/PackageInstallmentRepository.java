package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.enums.ClientPackageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
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
     * ALL installments (paid + unpaid) across a set of packages, batched so the
     * Phase 5 "summaries" endpoint can compute collected + hasOpenDue per assignment
     * in Java from a single result set. Derives {@code assignment.id IN (...)}.
     */
    List<PackageInstallment> findByAssignmentIdIn(Collection<UUID> assignmentIds);

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

    /**
     * Cross-package feed of installments PAID in [from, to] (by paidDate), excluding
     * CANCELLED assignments. Mirrors {@link #findUnpaidDueBetween} exactly (same
     * fetch-joins, same enum-param idiom) so the agenda's "due" feed can keep a rata
     * settled today visible as "saldato" alongside the still-unpaid ones.
     */
    @Query("""
            select pi from PackageInstallment pi
            join fetch pi.assignment a
            left join fetch a.service s
            where pi.paid = true
              and pi.paidDate between :from and :to
              and a.status <> :excludedStatus
            order by pi.paidDate asc, a.clientName asc
            """)
    List<PackageInstallment> findPaidByPaidDateBetween(@Param("from") LocalDate from,
                                                       @Param("to") LocalDate to,
                                                       @Param("excludedStatus") ClientPackageStatus excludedStatus);

    /**
     * Phase 4a — report "packages" revenue stream. Sum of PAID installment amounts
     * bucketed by paid month over the half-open range [from, to). Same Object[]
     * (year, month, sum) shape as the treatments/products monthly aggregations, so
     * ReportService can merge all three streams the same way.
     */
    @Query("""
            select year(pi.paidDate), month(pi.paidDate), sum(pi.amount)
            from PackageInstallment pi
            where pi.paid = true
              and pi.paidDate >= :from and pi.paidDate < :to
            group by year(pi.paidDate), month(pi.paidDate)
            order by year(pi.paidDate), month(pi.paidDate)
            """)
    List<Object[]> monthlyPackageRevenue(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * Phase 4a — scalar packages total for the period summary, same half-open range.
     */
    @Query("""
            select coalesce(sum(pi.amount), 0)
            from PackageInstallment pi
            where pi.paid = true
              and pi.paidDate >= :from and pi.paidDate < :to
            """)
    BigDecimal totalPackageRevenue(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
