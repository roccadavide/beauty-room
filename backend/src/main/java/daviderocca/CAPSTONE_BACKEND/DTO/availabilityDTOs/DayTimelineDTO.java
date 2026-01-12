package daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs;

import java.time.LocalDate;
import java.util.List;

public record DayTimelineDTO(
        LocalDate date,
        List<AvailabilitySlotDTO> openRanges,
        List<AvailabilitySlotDTO> closureRanges,
        List<AvailabilitySlotDTO> bookingRanges
) {}