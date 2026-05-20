package daviderocca.beautyroom.DTO.bookingDTOs;

import jakarta.validation.constraints.NotNull;

public record ReminderUpdateDTO(@NotNull Boolean sent) {}
