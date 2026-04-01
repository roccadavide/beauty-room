package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.notificationDTOs.NotificationDTO;
import daviderocca.beautyroom.entities.AdminNotification;
import daviderocca.beautyroom.enums.NotificationType;
import daviderocca.beautyroom.repositories.AdminNotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityNotFoundException;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminNotificationService {

    private final AdminNotificationRepository repo;

    /**
     * Propagation.REQUIRES_NEW: se la notifica fallisce NON fa rollback
     * della transazione chiamante (es. salvataggio booking).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void create(NotificationType type, String title, String body,
                       UUID entityId, String entityType) {
        AdminNotification n = new AdminNotification();
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        n.setEntityId(entityId);
        n.setEntityType(entityType);
        repo.save(n);
        log.info("Admin notification created: type={} title={}", type, title);
    }

    @Transactional(readOnly = true)
    public long countUnread() {
        return repo.countByReadAtIsNull();
    }

    @Transactional(readOnly = true)
    public Page<NotificationDTO> findAll(int page, int size) {
        return repo.findAllByOrderByCreatedAtDesc(PageRequest.of(page, Math.min(size, 100)))
                   .map(this::toDTO);
    }

    @Transactional
    public void markAsRead(UUID id) {
        repo.findById(id).ifPresent(n -> {
            if (n.getReadAt() == null) {
                n.setReadAt(LocalDateTime.now());
                repo.save(n);
            }
        });
    }

    @Transactional
    public int markAllAsRead() {
        return repo.markAllAsRead();
    }

    @Transactional
    public void deleteById(UUID id) {
        if (!repo.existsById(id)) {
            throw new EntityNotFoundException("Notifica non trovata: " + id);
        }
        repo.deleteById(id);
    }

    @Transactional
    public int deleteOlderThan(int days) {
        if (days <= 0) {
            throw new IllegalArgumentException("days deve essere > 0");
        }
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        return repo.deleteOlderThan(cutoff);
    }

    private NotificationDTO toDTO(AdminNotification n) {
        return new NotificationDTO(
            n.getId(), n.getType(), n.getTitle(), n.getBody(),
            n.getEntityId(), n.getEntityType(), n.isRead(), n.getCreatedAt()
        );
    }
}
