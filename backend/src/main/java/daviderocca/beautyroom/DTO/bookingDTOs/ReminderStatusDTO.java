package daviderocca.beautyroom.DTO.bookingDTOs;

import java.time.LocalDateTime;
import java.util.UUID;

public record ReminderStatusDTO(UUID bookingId, LocalDateTime reminderSentAt) {}
