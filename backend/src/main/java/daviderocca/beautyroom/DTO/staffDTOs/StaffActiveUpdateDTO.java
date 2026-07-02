package daviderocca.beautyroom.DTO.staffDTOs;

import jakarta.validation.constraints.NotNull;

/** PATCH /admin/staff/{id}/active payload. */
public record StaffActiveUpdateDTO(
        @NotNull(message = "Il flag active è obbligatorio")
        Boolean active
) {}
