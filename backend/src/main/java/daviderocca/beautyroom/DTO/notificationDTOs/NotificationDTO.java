package daviderocca.beautyroom.DTO.notificationDTOs;

import daviderocca.beautyroom.enums.NotificationType;
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
