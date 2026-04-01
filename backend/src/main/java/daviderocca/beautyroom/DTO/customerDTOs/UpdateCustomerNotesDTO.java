package daviderocca.beautyroom.DTO.customerDTOs;

import jakarta.validation.constraints.Size;

public record UpdateCustomerNotesDTO(
        @Size(max = 2000) String notes
) {}

