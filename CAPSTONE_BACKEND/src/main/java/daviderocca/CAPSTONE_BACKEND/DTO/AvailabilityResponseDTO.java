package daviderocca.CAPSTONE_BACKEND.DTO;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record AvailabilityResponseDTO(
        UUID serviceId,
        LocalDate date,
        int stepMinutes,
        List<AvailabilitySlotDTO> slots
) {}