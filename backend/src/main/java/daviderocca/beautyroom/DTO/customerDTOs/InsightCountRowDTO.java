package daviderocca.beautyroom.DTO.customerDTOs;

import java.util.UUID;

/**
 * One ranked row in a count-based insight table (top by completed appointments / by packages).
 * {@code customerId} is nullable: present (and clickable in the UI) when the row resolved to a
 * real customer, null for best-effort name-only rows (e.g. an in-store package whose free-text
 * client_name matched no customer).
 */
public record InsightCountRowDTO(
        UUID customerId,
        String name,
        String phone,
        long count
) {}
