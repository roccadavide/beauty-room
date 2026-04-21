package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.AdminNotification;
import daviderocca.beautyroom.enums.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.UUID;

public interface AdminNotificationRepository extends JpaRepository<AdminNotification, UUID> {
    long countByReadAtIsNull();
    Page<AdminNotification> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Controlla se esiste già una notifica recente dello stesso tipo per la stessa entità (anti-duplicazione). */
    @Query("""
        SELECT COUNT(n) > 0 FROM AdminNotification n
        WHERE n.type = :type
          AND n.entityId = :entityId
          AND n.createdAt >= :since
    """)
    boolean existsRecentForEntity(
            @Param("type")     NotificationType type,
            @Param("entityId") UUID entityId,
            @Param("since")    LocalDateTime since
    );

    @Modifying
    @Query("UPDATE AdminNotification n SET n.readAt = CURRENT_TIMESTAMP WHERE n.readAt IS NULL")
    int markAllAsRead();

    @Modifying
    @Query("DELETE FROM AdminNotification n WHERE n.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
