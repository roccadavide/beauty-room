package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.reportDTOs.MonthlyRevenueDTO;
import daviderocca.beautyroom.DTO.reportDTOs.PeriodSummaryDTO;
import daviderocca.beautyroom.DTO.reportDTOs.ReportResponseDTO;
import daviderocca.beautyroom.DTO.reportDTOs.ServiceRevenueDTO;
import daviderocca.beautyroom.DTO.reportDTOs.TopClientDTO;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.repositories.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;

    public ReportResponseDTO getReport(LocalDate from, LocalDate to) {
        if (from == null || to == null) throw new BadRequestException("Range obbligatorio.");
        if (!from.isBefore(to)) throw new BadRequestException("'from' deve essere prima di 'to'.");
        if (ChronoUnit.MONTHS.between(from, to) > 24)
            throw new BadRequestException("Range massimo 24 mesi.");

        LocalDateTime fromDT = from.atStartOfDay();
        LocalDateTime toDT = to.plusDays(1).atStartOfDay();

        List<Object[]> treatmentsRows = reportRepository.monthlyTreatmentRevenue(fromDT, toDT);
        List<Object[]> productsRows = reportRepository.monthlyProductRevenue(fromDT, toDT);

        List<MonthlyRevenueDTO> monthly = mergeMonthly(treatmentsRows, productsRows, from, to);
        List<ServiceRevenueDTO> topServices = reportRepository.topServices(fromDT, toDT);
        List<TopClientDTO> topClients = reportRepository.topClients(fromDT, toDT);
        PeriodSummaryDTO summary = reportRepository.periodSummary(fromDT, toDT);

        return new ReportResponseDTO(monthly, topServices, topClients, summary);
    }

    private List<MonthlyRevenueDTO> mergeMonthly(
            List<Object[]> treatmentsRows,
            List<Object[]> productsRows,
            LocalDate from,
            LocalDate to
    ) {
        Map<String, BigDecimal> treatmentsMap = new HashMap<>();
        Map<String, BigDecimal> productsMap = new HashMap<>();

        for (Object[] r : treatmentsRows) {
            int year = ((Number) r[0]).intValue();
            int month = ((Number) r[1]).intValue();
            BigDecimal value = (BigDecimal) r[2];
            treatmentsMap.put(year + "-" + month, value != null ? value : BigDecimal.ZERO);
        }
        for (Object[] r : productsRows) {
            int year = ((Number) r[0]).intValue();
            int month = ((Number) r[1]).intValue();
            BigDecimal value = (BigDecimal) r[2];
            productsMap.put(year + "-" + month, value != null ? value : BigDecimal.ZERO);
        }

        List<MonthlyRevenueDTO> result = new ArrayList<>();
        LocalDate cursor = LocalDate.of(from.getYear(), from.getMonth(), 1);
        LocalDate endMonth = LocalDate.of(to.getYear(), to.getMonth(), 1);

        while (!cursor.isAfter(endMonth)) {
            int y = cursor.getYear();
            int m = cursor.getMonthValue();
            String key = y + "-" + m;
            BigDecimal t = treatmentsMap.getOrDefault(key, BigDecimal.ZERO);
            BigDecimal p = productsMap.getOrDefault(key, BigDecimal.ZERO);
            BigDecimal total = t.add(p);
            result.add(new MonthlyRevenueDTO(y, m, t, p, total));
            cursor = cursor.plusMonths(1);
        }

        return result;
    }
}

