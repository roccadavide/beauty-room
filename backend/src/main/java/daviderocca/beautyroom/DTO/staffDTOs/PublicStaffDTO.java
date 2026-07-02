package daviderocca.beautyroom.DTO.staffDTOs;

import java.util.UUID;

/** GET /api/public/staff item — active staff exposed to the public booking flow. */
public record PublicStaffDTO(
        UUID id,
        String displayName,
        String color,
        int sortOrder
) {}
