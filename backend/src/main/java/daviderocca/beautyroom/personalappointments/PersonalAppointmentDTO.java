package daviderocca.beautyroom.personalappointments;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

public record PersonalAppointmentDTO(
        UUID id,
        String title,
        String notes,
        LocalDate appointmentDate,
        LocalTime startTime,
        int durationMinutes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
