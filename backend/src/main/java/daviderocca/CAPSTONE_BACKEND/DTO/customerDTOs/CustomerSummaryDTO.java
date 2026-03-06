package daviderocca.CAPSTONE_BACKEND.DTO.customerDTOs;

import java.util.UUID;

public record CustomerSummaryDTO(
        UUID customerId,
        String fullName,
        String phone,
        String email
) {}