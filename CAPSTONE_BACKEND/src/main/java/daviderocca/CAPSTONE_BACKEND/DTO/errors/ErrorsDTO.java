package daviderocca.CAPSTONE_BACKEND.DTO.errors;

import java.time.LocalDateTime;

public record ErrorsDTO(
        String message,
        LocalDateTime timestamp)
{}
