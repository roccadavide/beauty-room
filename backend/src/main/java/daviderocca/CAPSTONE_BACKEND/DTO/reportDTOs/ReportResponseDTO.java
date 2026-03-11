package daviderocca.CAPSTONE_BACKEND.DTO.reportDTOs;

import java.util.List;

public record ReportResponseDTO(
        List<MonthlyRevenueDTO> monthlyRevenue,
        List<ServiceRevenueDTO> topServices,
        List<TopClientDTO> topClients,
        PeriodSummaryDTO summary
) {}

