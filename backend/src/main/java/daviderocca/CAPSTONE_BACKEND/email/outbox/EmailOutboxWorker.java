package daviderocca.CAPSTONE_BACKEND.email.outbox;

import daviderocca.CAPSTONE_BACKEND.email.events.EmailAggregateType;
import daviderocca.CAPSTONE_BACKEND.email.events.EmailEventType;
import daviderocca.CAPSTONE_BACKEND.email.provider.MailgunSender;
import daviderocca.CAPSTONE_BACKEND.email.templates.EmailContent;
import daviderocca.CAPSTONE_BACKEND.email.templates.EmailTemplateService;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.Order;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.net.InetAddress;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class EmailOutboxWorker {

    private final EmailOutboxRepository outboxRepo;
    private final BookingRepository bookingRepo;
    private final OrderRepository orderRepo;

    private final MailgunSender mailgunSender;
    private final EmailTemplateService templates;

    private final String lockOwner = resolveLockOwner();

    @Scheduled(fixedDelayString = "${email.outbox.pollMs:15000}")
    public void run() {
        // 1) claim batch (transazione breve)
        List<UUID> claimedIds = claimBatchIds(50);

        // 2) processa uno a uno (transazione separata per item)
        for (UUID id : claimedIds) {
            try {
                processOne(id);
            } catch (Exception e) {
                // processOne gestisce già retry/status: qui log solo “di sicurezza”
                log.error("processOne crashed: id={} err={}", id, e.getMessage(), e);
            }
        }
    }

    @Transactional
    protected List<UUID> claimBatchIds(int limit) {
        LocalDateTime now = LocalDateTime.now();

        List<EmailOutbox> batch = outboxRepo.lockNextBatchPending(now, limit);
        if (batch.isEmpty()) return List.of();

        for (EmailOutbox e : batch) {
            e.setStatus(EmailOutboxStatus.PROCESSING);
            e.setLockedAt(now);
            e.setLockOwner(lockOwner);
            // attempts NON incrementare qui: incrementiamo solo quando fallisce un invio vero
        }

        outboxRepo.saveAll(batch);

        return batch.stream().map(EmailOutbox::getId).toList();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    protected void processOne(UUID id) {
        EmailOutbox e = outboxRepo.findById(id)
                .orElseThrow(() -> new IllegalStateException("EmailOutbox not found: " + id));

        // se qualcuno l'ha già gestita nel frattempo
        if (e.getStatus() == EmailOutboxStatus.SENT
                || e.getStatus() == EmailOutboxStatus.FAILED
                || e.getStatus() == EmailOutboxStatus.CANCELLED) {
            return;
        }

        // safety: deve essere PROCESSING (claimato)
        if (e.getStatus() != EmailOutboxStatus.PROCESSING) {
            return;
        }

        try {
            EmailContent content = buildContent(e);

            String providerMsgId = mailgunSender.sendHtml(
                    e.getToEmail(),
                    content.subject(),
                    content.html(),
                    content.text()
            );

            e.setStatus(EmailOutboxStatus.SENT);
            e.setSentAt(LocalDateTime.now());
            e.setProviderMessageId(providerMsgId);
            e.setLastError(null);

        } catch (SkipEmailException skip) {
            e.setStatus(EmailOutboxStatus.CANCELLED);
            e.setLastError(safeMsg(skip));
            e.setSentAt(null);
            e.setProviderMessageId(null);

        } catch (Exception ex) {
            handleFailure(e, ex);
        } finally {
            e.setLockedAt(null);
            e.setLockOwner(null);
            outboxRepo.save(e);
        }
    }

    private void handleFailure(EmailOutbox e, Exception ex) throws DataAccessException {
        int attempts = e.getAttempts() + 1;
        e.setAttempts(attempts);
        e.setLastError(safeMsg(ex));

        if (attempts >= 6) {
            e.setStatus(EmailOutboxStatus.FAILED);
            e.setScheduledAt(LocalDateTime.now()); // irrilevante, ma coerente
        } else {
            e.setStatus(EmailOutboxStatus.PENDING);
            e.setScheduledAt(LocalDateTime.now().plusMinutes(backoffMinutes(attempts)));
        }

        // pulizia lock
        e.setLockedAt(null);
        e.setLockOwner(null);

        log.warn("Email send failed: id={} event={} agg={} attempts={} err={}",
                e.getId(), e.getEventType(), e.getAggregateId(), attempts, e.getLastError());
    }

    private int backoffMinutes(int attempt) {
        return switch (attempt) {
            case 1 -> 1;
            case 2 -> 5;
            case 3 -> 15;
            case 4 -> 60;
            default -> 180;
        };
    }

    private EmailContent buildContent(EmailOutbox e) {
        EmailAggregateType agg = e.getAggregateType();
        EmailEventType type = e.getEventType();

        if (agg == EmailAggregateType.BOOKING) {
            Booking b = bookingRepo.findByIdWithDetails(e.getAggregateId())
                    .orElseThrow(() -> new IllegalStateException("Booking not found: " + e.getAggregateId()));

            if (b.getBookingStatus() == null || b.getBookingStatus().name().equals("CANCELLED")) {
                throw new SkipEmailException("Booking cancelled (skip): " + b.getBookingId());
            }

            return switch (type) {
                case BOOKING_CONFIRMED -> templates.bookingConfirmed(b);
                case BOOKING_REMINDER_24H -> templates.bookingReminder(b);
                default -> throw new IllegalArgumentException("Unsupported booking event: " + type);
            };
        }

        if (agg == EmailAggregateType.ORDER) {
            Order o = orderRepo.findByIdWithItems(e.getAggregateId())
                    .orElseThrow(() -> new IllegalStateException("Order not found: " + e.getAggregateId()));

            return switch (type) {
                case ORDER_PAID -> templates.orderPaid(o);
                default -> throw new IllegalArgumentException("Unsupported order event: " + type);
            };
        }

        throw new IllegalArgumentException("Unsupported aggregate: " + agg);
    }

    private static String safeMsg(Exception ex) {
        String m = ex.getMessage();
        if (m == null) return ex.getClass().getSimpleName();
        return (m.length() > 750) ? m.substring(0, 750) : m;
    }

    private static String resolveLockOwner() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "worker";
        }
    }

    static class SkipEmailException extends RuntimeException {
        SkipEmailException(String message) { super(message); }
    }
}