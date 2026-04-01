package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.AdminNotification;
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

    @Modifying
    @Query("UPDATE AdminNotification n SET n.readAt = CURRENT_TIMESTAMP WHERE n.readAt IS NULL")
    int markAllAsRead();

    @Modifying
    @Query("DELETE FROM AdminNotification n WHERE n.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
