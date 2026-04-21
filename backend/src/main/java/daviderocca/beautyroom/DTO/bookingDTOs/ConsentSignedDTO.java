package daviderocca.beautyroom.DTO.bookingDTOs;

import jakarta.validation.constraints.NotNull;

public record ConsentSignedDTO(@NotNull Boolean signed) {}
