package daviderocca.CAPSTONE_BACKEND.DTO.customerDTOs;

import jakarta.validation.constraints.Size;

public record UpdateCustomerNotesDTO(
        @Size(max = 2000) String notes
) {}

