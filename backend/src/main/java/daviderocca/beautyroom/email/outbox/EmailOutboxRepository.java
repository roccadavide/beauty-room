package daviderocca.beautyroom.email.outbox;

import daviderocca.beautyroom.email.events.EmailAggregateType;
import daviderocca.beautyroom.email.events.EmailEventType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface EmailOutboxRepository extends JpaRepository<EmailOutbox, UUID> {

    boolean existsByEventTypeAndAggregateTypeAndAggregateId(
            EmailEventType eventType,
            EmailAggregateType aggregateType,
            UUID aggregateId
    );

    @Query(value = """
        SELECT *
        FROM email_outbox
        WHERE status = 'PENDING'
          AND scheduled_at <= :now
        ORDER BY created_at ASC
        LIMIT :limit
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<EmailOutbox> lockNextBatchPending(@Param("now") LocalDateTime now, @Param("limit") int limit);
}