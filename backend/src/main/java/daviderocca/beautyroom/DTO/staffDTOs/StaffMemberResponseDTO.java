package daviderocca.beautyroom.DTO.staffDTOs;

import java.util.List;
import java.util.UUID;

/** Admin view of a staff member (GET /admin/staff and write-endpoint responses). */
public record StaffMemberResponseDTO(
        UUID id,
        String displayName,
        String color,
        boolean active,
        int sortOrder,
        String userEmail,
        List<UUID> serviceIds
) {}
