package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

/**
 * A top client by collected revenue. Clients are keyed on customer_id when present,
 * else normalized phone (same key as newClientsCount — fixes the D11 inconsistency).
 * {@code visits} = collected treatment appointments in the period.
 */
public record TopClientReportDTO(
        String name,
        String phone,
        BigDecimal revenue,
        long visits
) {}
