package daviderocca.CAPSTONE_BACKEND.DTO.notificationDTOs;

import daviderocca.CAPSTONE_BACKEND.enums.NotificationType;
import java.time.LocalDateTime;
import java.util.UUID;

public record NotificationDTO(
    UUID id,
    NotificationType type,
    String title,
    String body,
    UUID entityId,
    String entityType,
    boolean read,
    LocalDateTime createdAt
) {}
