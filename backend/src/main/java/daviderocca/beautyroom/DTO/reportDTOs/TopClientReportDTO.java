package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A top client by collected revenue. Clients are keyed on customer_id when present,
 * else normalized phone (same key as newClientsCount — fixes the D11 inconsistency).
 * {@code customerId} is surfaced from that same layered key: non-null only when the
 * client resolved to a real customer_id (then the row is clickable in the UI), null for
 * phone-/name-keyed rows. {@code visits} = collected treatment appointments in the period.
 */
public record TopClientReportDTO(
        UUID customerId,
        String name,
        String phone,
        BigDecimal revenue,
        long visits
) {}
