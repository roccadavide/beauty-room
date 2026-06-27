package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.reportDTOs.ByChannelDTO;
import daviderocca.beautyroom.DTO.reportDTOs.ByTypeDTO;
import daviderocca.beautyroom.DTO.reportDTOs.ComparisonDTO;
import daviderocca.beautyroom.DTO.reportDTOs.IncassatoDTO;
import daviderocca.beautyroom.DTO.reportDTOs.MonthlyRevenueDTO;
import daviderocca.beautyroom.DTO.reportDTOs.PrevistoDTO;
import daviderocca.beautyroom.DTO.reportDTOs.ReportRangeDTO;
import daviderocca.beautyroom.DTO.reportDTOs.ReportResponseDTO;
import daviderocca.beautyroom.DTO.reportDTOs.TopClientReportDTO;
import daviderocca.beautyroom.DTO.reportDTOs.TopProductDTO;
import daviderocca.beautyroom.DTO.reportDTOs.TopServiceDTO;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.repositories.ReportRepository;
import daviderocca.beautyroom.repositories.ReportRepository.ClientSeedRow;
import daviderocca.beautyroom.repositories.ReportRepository.NameAmountRow;
import daviderocca.beautyroom.repositories.ReportRepository.OnlinePackages;
import daviderocca.beautyroom.repositories.ReportRepository.PipelineStat;
import daviderocca.beautyroom.repositories.ReportRepository.ProductLineRow;
import daviderocca.beautyroom.repositories.ReportRepository.RevenueRow;
import daviderocca.beautyroom.util.PhoneNormalizer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Two-ledger admin report (cash-basis). The repository extracts raw valued rows per
 * leg; this service partitions them — every collected euro lands in exactly ONE leg —
 * and assembles {@code incassato} (collected), {@code previsto} (pipeline + arretrati)
 * and {@code comparison} (the same model run over the compare window). Top-N tables,
 * client metrics and scalar counts are derived from the same fetched rows.
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    private static final int TOP_N = 10;

    private enum Leg { TRATT, PROD, PKG, PROMO }

    private record Signed(LocalDateTime at, BigDecimal amount, boolean online, Leg leg) {}

    /** All valued rows for one range (packages = admin installments + upfront + online). */
    private record Legs(List<RevenueRow> treatments, List<RevenueRow> refunds,
                        List<ProductLineRow> products, List<RevenueRow> packages,
                        List<RevenueRow> promotions, long flaggedSkipped) {}

    public ReportResponseDTO getReport(LocalDate from, LocalDate to, String compareRaw) {
        if (from == null || to == null) throw new BadRequestException("Range obbligatorio.");
        if (from.isAfter(to)) throw new BadRequestException("'from' non può essere dopo 'to'.");
        if (ChronoUnit.MONTHS.between(from, to) > 24)
            throw new BadRequestException("Range massimo 24 mesi.");

        String compareMode = normalizeCompareMode(compareRaw);

        // --- Main range ------------------------------------------------------------
        Legs legs = fetchLegs(from, to);
        IncassatoDTO incassato = buildIncassato(legs, from, to);

        // --- Comparison ------------------------------------------------------------
        LocalDate compareFrom = null, compareTo = null;
        ComparisonDTO comparison = zeroComparison();
        if (!"none".equals(compareMode)) {
            if ("prevYear".equals(compareMode)) {
                compareFrom = from.minusYears(1);
                compareTo = to.minusYears(1);
            } else { // prevPeriod — the equal-length window immediately before `from`
                long span = ChronoUnit.DAYS.between(from, to); // inclusive length = span + 1
                compareTo = from.minusDays(1);
                compareFrom = compareTo.minusDays(span);
            }
            IncassatoDTO compareIncassato = buildIncassato(fetchLegs(compareFrom, compareTo), compareFrom, compareTo);
            comparison = delta(incassato, compareIncassato);
        }
        ReportRangeDTO range = new ReportRangeDTO(from, to, compareMode, compareFrom, compareTo);

        // --- Top-N + client metrics + counts (main range) --------------------------
        List<TopServiceDTO> topServices = buildTopServices(from, to);
        List<TopProductDTO> topProducts = buildTopProducts(legs.products());
        List<TopClientReportDTO> topClients = buildTopClients(legs);

        LocalDateTime fromDT = from.atStartOfDay();
        LocalDateTime toDT = to.plusDays(1).atStartOfDay();
        long newClientsCount = countNewClients(fromDT, toDT);
        long cancelledCount = reportRepository.cancelledCount(fromDT, toDT);

        // --- Previsto (pipeline + arretrati) ---------------------------------------
        PipelineStat pipeline = reportRepository.pipeline(LocalDateTime.now());
        PrevistoDTO previsto = new PrevistoDTO(
                sc(pipeline.total()), sc(reportRepository.arretratiTotal()), pipeline.count());

        return new ReportResponseDTO(
                range, incassato, previsto, comparison,
                topServices, topProducts, topClients,
                newClientsCount, cancelledCount, legs.flaggedSkipped());
    }

    // ===============================================================================
    // Fetch + partition
    // ===============================================================================

    private Legs fetchLegs(LocalDate from, LocalDate to) {
        LocalDateTime fromDT = from.atStartOfDay();
        LocalDateTime toDT = to.plusDays(1).atStartOfDay();
        LocalDate toExclusive = to.plusDays(1);

        OnlinePackages online = reportRepository.onlinePackageRows(fromDT, toDT);

        List<RevenueRow> packages = new ArrayList<>();
        packages.addAll(reportRepository.adminInstallmentRows(from, toExclusive));
        packages.addAll(reportRepository.adminUpfrontFallbackRows(fromDT, toDT));
        packages.addAll(online.rows());

        List<ProductLineRow> products = new ArrayList<>();
        products.addAll(reportRepository.inStoreProductRows(fromDT, toDT));
        products.addAll(reportRepository.onlineProductRows(fromDT, toDT));

        return new Legs(
                reportRepository.treatmentRows(fromDT, toDT),
                reportRepository.refundRows(fromDT, toDT),
                products,
                packages,
                reportRepository.promotionRows(fromDT, toDT),
                online.flaggedSkipped());
    }

    private IncassatoDTO buildIncassato(Legs legs, LocalDate from, LocalDate to) {
        // One signed row per money event — refunds are negative treatments (folded in,
        // so the byType legs still sum exactly to the total).
        List<Signed> signed = new ArrayList<>();
        for (RevenueRow r : legs.treatments())  signed.add(new Signed(r.collectedAt(), nz(r.amount()), r.online(), Leg.TRATT));
        for (RevenueRow r : legs.refunds())     signed.add(new Signed(r.collectedAt(), nz(r.amount()).negate(), r.online(), Leg.TRATT));
        for (ProductLineRow r : legs.products()) signed.add(new Signed(r.collectedAt(), nz(r.amount()), r.online(), Leg.PROD));
        for (RevenueRow r : legs.packages())    signed.add(new Signed(r.collectedAt(), nz(r.amount()), r.online(), Leg.PKG));
        for (RevenueRow r : legs.promotions())  signed.add(new Signed(r.collectedAt(), nz(r.amount()), r.online(), Leg.PROMO));

        BigDecimal trattamenti = BigDecimal.ZERO, prodotti = BigDecimal.ZERO,
                   pacchetti = BigDecimal.ZERO, promozioni = BigDecimal.ZERO,
                   online = BigDecimal.ZERO, inStore = BigDecimal.ZERO;
        for (Signed s : signed) {
            switch (s.leg()) {
                case TRATT -> trattamenti = trattamenti.add(s.amount());
                case PROD  -> prodotti = prodotti.add(s.amount());
                case PKG   -> pacchetti = pacchetti.add(s.amount());
                case PROMO -> promozioni = promozioni.add(s.amount());
            }
            if (s.online()) online = online.add(s.amount());
            else inStore = inStore.add(s.amount());
        }
        BigDecimal total = trattamenti.add(prodotti).add(pacchetti).add(promozioni);

        BigDecimal refundsTotal = BigDecimal.ZERO;
        for (RevenueRow r : legs.refunds()) refundsTotal = refundsTotal.add(nz(r.amount()));

        long appointments = legs.treatments().size();
        BigDecimal averageTicket = appointments > 0
                ? total.divide(BigDecimal.valueOf(appointments), 2, RoundingMode.HALF_UP)
                : ZERO;

        List<MonthlyRevenueDTO> monthly = buildMonthly(signed, from, to);

        return new IncassatoDTO(
                sc(total),
                new ByTypeDTO(sc(trattamenti), sc(prodotti), sc(pacchetti), sc(promozioni)),
                new ByChannelDTO(sc(online), sc(inStore)),
                sc(refundsTotal),
                averageTicket,
                appointments,
                monthly);
    }

    private List<MonthlyRevenueDTO> buildMonthly(List<Signed> signed, LocalDate from, LocalDate to) {
        // [trattamenti, prodotti, pacchetti, promozioni] per calendar month.
        Map<YearMonth, BigDecimal[]> byMonth = new HashMap<>();
        for (Signed s : signed) {
            if (s.at() == null) continue;
            YearMonth ym = YearMonth.from(s.at());
            BigDecimal[] cells = byMonth.computeIfAbsent(ym,
                    k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            int idx = switch (s.leg()) { case TRATT -> 0; case PROD -> 1; case PKG -> 2; case PROMO -> 3; };
            cells[idx] = cells[idx].add(s.amount());
        }

        List<MonthlyRevenueDTO> out = new ArrayList<>();
        YearMonth cursor = YearMonth.of(from.getYear(), from.getMonthValue());
        YearMonth end = YearMonth.of(to.getYear(), to.getMonthValue());
        while (!cursor.isAfter(end)) {
            BigDecimal[] c = byMonth.getOrDefault(cursor,
                    new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            BigDecimal totale = c[0].add(c[1]).add(c[2]).add(c[3]);
            out.add(new MonthlyRevenueDTO(cursor.getYear(), cursor.getMonthValue(),
                    sc(c[0]), sc(c[1]), sc(c[2]), sc(c[3]), sc(totale)));
            cursor = cursor.plusMonths(1);
        }
        return out;
    }

    // ===============================================================================
    // Comparison
    // ===============================================================================

    private ComparisonDTO delta(IncassatoDTO main, IncassatoDTO cmp) {
        BigDecimal d = main.total().subtract(cmp.total());
        BigDecimal pct = cmp.total().signum() == 0
                ? ZERO
                : d.multiply(BigDecimal.valueOf(100)).divide(cmp.total(), 2, RoundingMode.HALF_UP);
        ByTypeDTO bt = new ByTypeDTO(
                sc(main.byType().trattamenti().subtract(cmp.byType().trattamenti())),
                sc(main.byType().prodotti().subtract(cmp.byType().prodotti())),
                sc(main.byType().pacchetti().subtract(cmp.byType().pacchetti())),
                sc(main.byType().promozioni().subtract(cmp.byType().promozioni())));
        return new ComparisonDTO(sc(d), pct, bt);
    }

    private ComparisonDTO zeroComparison() {
        return new ComparisonDTO(ZERO, ZERO, new ByTypeDTO(ZERO, ZERO, ZERO, ZERO));
    }

    // ===============================================================================
    // Top-N + client metrics
    // ===============================================================================

    private List<TopServiceDTO> buildTopServices(LocalDate from, LocalDate to) {
        List<NameAmountRow> rows = reportRepository.topServiceRows(from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        Map<String, long[]> counts = new HashMap<>();           // name -> [count]
        Map<String, BigDecimal> revenue = new LinkedHashMap<>(); // name -> revenue
        for (NameAmountRow r : rows) {
            String name = r.name() == null ? "Servizio" : r.name();
            counts.computeIfAbsent(name, k -> new long[1])[0]++;
            revenue.merge(name, nz(r.amount()), BigDecimal::add);
        }
        return revenue.entrySet().stream()
                .map(e -> new TopServiceDTO(e.getKey(), counts.get(e.getKey())[0], sc(e.getValue())))
                .sorted(Comparator.comparing(TopServiceDTO::revenue).reversed())
                .limit(TOP_N)
                .toList();
    }

    private List<TopProductDTO> buildTopProducts(List<ProductLineRow> products) {
        Map<String, long[]> qty = new HashMap<>();
        Map<String, BigDecimal> revenue = new LinkedHashMap<>();
        for (ProductLineRow r : products) {
            String name = r.productName() == null ? "Prodotto" : r.productName();
            qty.computeIfAbsent(name, k -> new long[1])[0] += r.quantity();
            revenue.merge(name, nz(r.amount()), BigDecimal::add);
        }
        return revenue.entrySet().stream()
                .map(e -> new TopProductDTO(e.getKey(), qty.get(e.getKey())[0], sc(e.getValue())))
                .sorted(Comparator.comparing(TopProductDTO::revenue).reversed())
                .limit(TOP_N)
                .toList();
    }

    /** Client revenue across every leg, keyed on customer_id / normalized phone (D11). */
    private List<TopClientReportDTO> buildTopClients(Legs legs) {
        Map<String, BigDecimal> revenue = new HashMap<>();
        Map<String, long[]> visits = new HashMap<>();
        Map<String, String[]> display = new LinkedHashMap<>(); // key -> [name, phone]

        for (RevenueRow r : legs.treatments()) {
            String k = accrue(revenue, display, r.clientId(), r.clientName(), r.clientPhone(), nz(r.amount()));
            if (k != null) visits.computeIfAbsent(k, x -> new long[1])[0]++;
        }
        for (RevenueRow r : legs.refunds())
            accrue(revenue, display, r.clientId(), r.clientName(), r.clientPhone(), nz(r.amount()).negate());
        for (ProductLineRow r : legs.products())
            accrue(revenue, display, r.clientId(), r.clientName(), r.clientPhone(), nz(r.amount()));
        for (RevenueRow r : legs.packages())
            accrue(revenue, display, r.clientId(), r.clientName(), r.clientPhone(), nz(r.amount()));
        for (RevenueRow r : legs.promotions())
            accrue(revenue, display, r.clientId(), r.clientName(), r.clientPhone(), nz(r.amount()));

        return revenue.entrySet().stream()
                .map(e -> new TopClientReportDTO(
                        display.get(e.getKey())[0], display.get(e.getKey())[1],
                        sc(e.getValue()),
                        visits.getOrDefault(e.getKey(), new long[1])[0]))
                .sorted(Comparator.comparing(TopClientReportDTO::revenue).reversed())
                .limit(TOP_N)
                .toList();
    }

    /** Accrue amount onto a client's identity bucket; returns the key (null = anonymous). */
    private String accrue(Map<String, BigDecimal> revenue, Map<String, String[]> display,
                          String clientId, String name, String phone, BigDecimal amount) {
        String key = clientKey(clientId, phone, name);
        if (key == null) return null;
        revenue.merge(key, amount, BigDecimal::add);
        String[] d = display.computeIfAbsent(key, k -> new String[2]);
        if ((d[0] == null || d[0].isBlank()) && name != null && !name.isBlank()) d[0] = name.trim();
        if ((d[1] == null || d[1].isBlank()) && phone != null && !phone.isBlank()) d[1] = phone.trim();
        return key;
    }

    private long countNewClients(LocalDateTime fromDT, LocalDateTime toDT) {
        // A client is "new" in the period iff their global-earliest booking falls in it.
        Map<String, LocalDateTime> earliest = new HashMap<>();
        for (ClientSeedRow r : reportRepository.clientSeedRows()) {
            String key = clientKey(r.clientId(), r.clientPhone(), r.clientName());
            if (key == null || r.firstAt() == null) continue;
            earliest.merge(key, r.firstAt(), (a, b) -> a.isBefore(b) ? a : b);
        }
        long count = 0;
        for (LocalDateTime first : earliest.values())
            if (!first.isBefore(fromDT) && first.isBefore(toDT)) count++;
        return count;
    }

    /** Same identity rule for topClients AND newClients (D11): customer_id, else E.164 phone, else name. */
    private static String clientKey(String clientId, String phone, String name) {
        if (clientId != null && !clientId.isBlank()) return "id:" + clientId;
        String np = PhoneNormalizer.normalize(phone);
        if (np != null) return "ph:" + np;
        if (name != null && !name.isBlank()) return "nm:" + name.trim().toLowerCase();
        return null;
    }

    // ===============================================================================
    // Helpers
    // ===============================================================================

    private static String normalizeCompareMode(String raw) {
        if (raw == null || raw.isBlank()) return "prevPeriod";
        String v = raw.trim();
        return switch (v) {
            case "none", "prevPeriod", "prevYear" -> v;
            default -> throw new BadRequestException("compare non valido: " + raw);
        };
    }

    private static BigDecimal nz(BigDecimal x) {
        return x == null ? BigDecimal.ZERO : x;
    }

    private static BigDecimal sc(BigDecimal x) {
        return (x == null ? BigDecimal.ZERO : x).setScale(2, RoundingMode.HALF_UP);
    }
}
