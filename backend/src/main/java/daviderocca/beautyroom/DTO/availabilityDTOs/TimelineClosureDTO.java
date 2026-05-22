package daviderocca.beautyroom.DTO.availabilityDTOs;

import java.util.UUID;

/**
 * Dedicated DTO for ad-hoc closures rendered on the admin agenda day timeline.
 * Carries id + reason + fullDay flag so the frontend can:
 *  - tag the block with the private reason
 *  - distinguish full-day spans from time-window spans
 *  - load the closure into the drawer for editing (via id)
 *
 * Kept separate from {@link AvailabilitySlotDTO} so the shared availability
 * slot shape stays unchanged.
 */
public record TimelineClosureDTO(
        UUID id,
        String start,    // "HH:mm"
        String end,      // "HH:mm"
        boolean fullDay,
        String reason
) {}
