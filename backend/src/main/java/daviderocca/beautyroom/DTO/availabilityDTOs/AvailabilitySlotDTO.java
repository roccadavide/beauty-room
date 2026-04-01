package daviderocca.beautyroom.DTO.availabilityDTOs;

public record AvailabilitySlotDTO(
        String start,
        String end,
        boolean available
) {}