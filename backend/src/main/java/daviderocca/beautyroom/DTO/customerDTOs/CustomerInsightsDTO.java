package daviderocca.beautyroom.DTO.customerDTOs;

import daviderocca.beautyroom.DTO.reportDTOs.TopClientReportDTO;

import java.math.BigDecimal;
import java.util.List;

/**
 * Overview dashboard for the customers workspace. Pure read, aggregate queries only.
 *
 * <ul>
 *   <li>{@code totalCustomers} — count of all customers.</li>
 *   <li>{@code trustedCustomersCount} — count of verified Users. APPROXIMATE headline: trust
 *       lives on User, not Customer, and there is no Customer↔User key (audit Section E).</li>
 *   <li>{@code activePackagesCount} — ACTIVE online (PackageCredit) + ACTIVE in-store
 *       (ClientPackageAssignment) packages.</li>
 *   <li>{@code outstandingTotal} — global arretrati total, reused verbatim from the report engine.</li>
 *   <li>{@code topByCompletedAppointments} — top 5 by COMPLETED booking count (FK-keyed).</li>
 *   <li>{@code topByPackages} — top 5 by package count, online (FK) merged best-effort with
 *       in-store (name-keyed).</li>
 *   <li>{@code topBySpend} — top 5 by all-time collected revenue (report layered key).</li>
 *   <li>{@code winBack} — up to 30 lapsed customers (last COMPLETED &gt; 60d ago, no active future).</li>
 * </ul>
 */
public record CustomerInsightsDTO(
        long totalCustomers,
        long trustedCustomersCount,
        long activePackagesCount,
        BigDecimal outstandingTotal,
        List<InsightCountRowDTO> topByCompletedAppointments,
        List<InsightCountRowDTO> topByPackages,
        List<TopClientReportDTO> topBySpend,
        List<WinBackRowDTO> winBack
) {}
