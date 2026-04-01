package daviderocca.beautyroom.DTO.customerDTOs;

import java.util.UUID;

public record CustomerSummaryDTO(
        UUID customerId,
        String fullName,
        String phone,
        String email
) {}