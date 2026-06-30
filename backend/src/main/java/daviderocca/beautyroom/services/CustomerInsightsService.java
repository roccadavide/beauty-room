package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.customerDTOs.CustomerInsightsDTO;
import daviderocca.beautyroom.DTO.customerDTOs.InsightCountRowDTO;
import daviderocca.beautyroom.DTO.customerDTOs.WinBackRowDTO;
import daviderocca.beautyroom.DTO.reportDTOs.TopClientReportDTO;
import daviderocca.beautyroom.entities.Customer;
import daviderocca.beautyroom.enums.ClientPackageStatus;
import daviderocca.beautyroom.enums.PackageCreditStatus;
import daviderocca.beautyroom.packages.ClientPackageAssignmentRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.CustomerRepository;
import daviderocca.beautyroom.repositories.PackageCreditRepository;
import daviderocca.beautyroom.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Customer-insights overview (the customers-workspace dashboard). Pure read, AGGREGATE queries
 * only — no per-customer N+1 loop. Reuses the report engine for spend + outstanding so those
 * figures stay consistent with {@code /admin/report}. Reads only ({@code @Transactional(readOnly)}).
 *
 * <p>Placement note: lives beside {@link ReportService}/{@link AvailabilityService} in the services
 * package and depends only on repositories + ReportService — ReportService does NOT depend back, so
 * there is no cycle (and CustomerService stays untouched, avoiding the BookingService cycle).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerInsightsService {

    private static final int TOP_N = 5;
    private static final int WIN_BACK_LIMIT = 30;
    private static final long WIN_BACK_MIN_DAYS = 60;

    private final CustomerRepository customerRepository;
    private final BookingRepository bookingRepository;
    private final PackageCreditRepository packageCreditRepository;
    private final ClientPackageAssignmentRepository clientPackageAssignmentRepository;
    private final UserRepository userRepository;
    private final ReportService reportService;

    public CustomerInsightsDTO getInsights() {
        long totalCustomers = customerRepository.count();
        long trustedCustomersCount = userRepository.countVerified();
        // Headline counts BOTH worlds: ACTIVE online credits + ACTIVE in-store assignments.
        long activePackagesCount =
                packageCreditRepository.countByStatus(PackageCreditStatus.ACTIVE)
              + clientPackageAssignmentRepository.countByStatus(ClientPackageStatus.ACTIVE);
        BigDecimal outstandingTotal = reportService.getOutstandingTotal();

        // ONE scan feeds both the completed-count ranking and the win-back last-visit.
        List<Object[]> completedStats = bookingRepository.completedStatsByCustomer();

        List<InsightCountRowDTO> topByCompletedAppointments = topByCompleted(completedStats);
        List<InsightCountRowDTO> topByPackages = topByPackages();
        List<TopClientReportDTO> topBySpend = reportService.getTopClientsAllTime(TOP_N);
        List<WinBackRowDTO> winBack = buildWinBack(completedStats);

        return new CustomerInsightsDTO(
                totalCustomers, trustedCustomersCount, activePackagesCount, outstandingTotal,
                topByCompletedAppointments, topByPackages, topBySpend, winBack);
    }

    /**
     * Top 5 by COMPLETED booking count. Rows come from {@code completedStatsByCustomer}:
     * [customerId, name, phone, count, lastCompletedAt]. All FK-keyed → all clickable.
     */
    private List<InsightCountRowDTO> topByCompleted(List<Object[]> rows) {
        return rows.stream()
                .sorted(Comparator.comparingLong((Object[] r) -> ((Number) r[3]).longValue()).reversed())
                .limit(TOP_N)
                .map(r -> new InsightCountRowDTO(
                        (UUID) r[0], (String) r[1], (String) r[2], ((Number) r[3]).longValue()))
                .toList();
    }

    /**
     * Top 5 by package count, merging online (PackageCredit, FK-keyed) with in-store
     * (ClientPackageAssignment, free-text client_name) under ONE identity per client — the same
     * layered-key philosophy as {@code ReportService.clientKey} (id → name). In-store rows are
     * resolved to a Customer best-effort by lowercased/trimmed full name; a name that matches no
     * customer (or collides — first customer wins, arbitrary) stays a non-clickable name-only row.
     */
    private List<InsightCountRowDTO> topByPackages() {
        // Load every customer ONCE (no per-row query) to resolve both online ids and in-store names.
        List<Customer> all = customerRepository.findAll();
        Map<UUID, Customer> byId = new HashMap<>();
        Map<String, Customer> byName = new HashMap<>();
        for (Customer c : all) {
            byId.put(c.getCustomerId(), c);
            if (c.getFullName() != null && !c.getFullName().isBlank()) {
                byName.putIfAbsent(c.getFullName().trim().toLowerCase(), c);
            }
        }

        Map<String, long[]> count = new LinkedHashMap<>();           // layered key -> [running count]
        Map<String, InsightCountRowDTO> identity = new HashMap<>();   // layered key -> display identity

        // ONLINE — FK-keyed, always clickable.
        for (Object[] r : packageCreditRepository.onlinePackageCountByCustomer()) {
            UUID cid = (UUID) r[0];
            if (cid == null) continue; // query already excludes null-customer credits; defensive
            long n = ((Number) r[1]).longValue();
            String key = "id:" + cid;
            count.computeIfAbsent(key, k -> new long[1])[0] += n;
            Customer c = byId.get(cid);
            identity.putIfAbsent(key, new InsightCountRowDTO(
                    cid, c != null ? c.getFullName() : null, c != null ? c.getPhone() : null, 0));
        }

        // IN-STORE — name-keyed; when the name resolves to a customer it merges under id:<cid>.
        for (Object[] r : clientPackageAssignmentRepository.packageCountByClientName()) {
            String clientName = (String) r[0];
            if (clientName == null || clientName.isBlank()) continue;
            long n = ((Number) r[1]).longValue();
            Customer c = byName.get(clientName.trim().toLowerCase());
            String key = c != null ? "id:" + c.getCustomerId() : "nm:" + clientName.trim().toLowerCase();
            count.computeIfAbsent(key, k -> new long[1])[0] += n;
            if (c != null) {
                identity.putIfAbsent(key, new InsightCountRowDTO(
                        c.getCustomerId(), c.getFullName(), c.getPhone(), 0));
            } else {
                identity.putIfAbsent(key, new InsightCountRowDTO(null, clientName.trim(), null, 0));
            }
        }

        return count.entrySet().stream()
                .map(e -> {
                    InsightCountRowDTO who = identity.get(e.getKey());
                    return new InsightCountRowDTO(who.customerId(), who.name(), who.phone(), e.getValue()[0]);
                })
                .sorted(Comparator.comparingLong(InsightCountRowDTO::count).reversed())
                .limit(TOP_N)
                .toList();
    }

    /**
     * Lapsed customers worth winning back: last COMPLETED visit older than 60 days AND no active
     * future booking (start &ge; today AND status in PENDING_PAYMENT/CONFIRMED). Order by lastVisit
     * DESC (most recently lapsed first — the most recoverable), limit 30. Rows come from
     * {@code completedStatsByCustomer}: [customerId, name, phone, count, lastCompletedAt].
     */
    private List<WinBackRowDTO> buildWinBack(List<Object[]> rows) {
        LocalDate today = LocalDate.now(AvailabilityService.BUSINESS_ZONE);
        LocalDate cutoff = today.minusDays(WIN_BACK_MIN_DAYS); // last visit must be strictly before this
        Set<UUID> activeFuture = new HashSet<>(
                bookingRepository.customerIdsWithActiveFutureBooking(today.atStartOfDay()));

        return rows.stream()
                .filter(r -> r[4] != null)                                            // has a last visit
                .filter(r -> ((LocalDateTime) r[4]).toLocalDate().isBefore(cutoff))   // older than 60 days
                .filter(r -> !activeFuture.contains((UUID) r[0]))                     // no active future booking
                .sorted(Comparator.comparing((Object[] r) -> (LocalDateTime) r[4]).reversed())
                .limit(WIN_BACK_LIMIT)
                .map(r -> {
                    LocalDate lastVisit = ((LocalDateTime) r[4]).toLocalDate();
                    long daysSince = ChronoUnit.DAYS.between(lastVisit, today);
                    return new WinBackRowDTO((UUID) r[0], (String) r[1], (String) r[2], lastVisit, daysSince);
                })
                .toList();
    }
}
