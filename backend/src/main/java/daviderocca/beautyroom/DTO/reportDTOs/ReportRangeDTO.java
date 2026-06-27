package daviderocca.beautyroom.DTO.reportDTOs;

import java.time.LocalDate;

/**
 * The report's date axis. {@code compareMode} ∈ {none, prevPeriod, prevYear};
 * {@code compareFrom}/{@code compareTo} describe the resolved comparison window
 * (null when compareMode = none). Dates serialize as ISO {@code yyyy-MM-dd}.
 */
public record ReportRangeDTO(
        LocalDate from,
        LocalDate to,
        String compareMode,
        LocalDate compareFrom,
        LocalDate compareTo
) {}
