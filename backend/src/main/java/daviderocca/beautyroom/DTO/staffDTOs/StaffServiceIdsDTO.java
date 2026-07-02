package daviderocca.beautyroom.DTO.staffDTOs;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/** GET/PUT /admin/staff/{id}/services body — replace-set semantics on staff_services. */
public record StaffServiceIdsDTO(
        @NotNull(message = "La lista dei servizi è obbligatoria (può essere vuota)")
        List<UUID> serviceIds
) {}
