package daviderocca.CAPSTONE_BACKEND.email.outbox;

import daviderocca.CAPSTONE_BACKEND.email.events.EmailAggregateType;
import daviderocca.CAPSTONE_BACKEND.email.events.EmailEventType;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.Order;
import daviderocca.CAPSTONE_BACKEND.entities.WaitlistEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmailOutboxService {

    private final EmailOutboxRepository repo;
    @Value("${app.admin.email:admin@beautyroom.local}")
    private String adminEmail;

    public void enqueueBookingConfirmed(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;

        enqueueSafe(
                EmailEventType.BOOKING_CONFIRMED,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                normalizeEmail(booking.getCustomerEmail()),
                LocalDateTime.now()
        );

        enqueueBookingReminder24h(booking);
    }

    public void enqueueBookingReminder24h(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;
        if (booking.getStartTime() == null) return;

        LocalDateTime now = LocalDateTime.now();

        LocalDateTime sched = booking.getStartTime().minusHours(24);

        LocalDateTime minSched = now.plusHours(1);
        if (sched.isBefore(minSched)) {
            return;
        }

        enqueueSafe(
                EmailEventType.BOOKING_REMINDER_24H,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                normalizeEmail(booking.getCustomerEmail()),
                sched
        );
    }

    public void enqueueOrderPaid(Order order) {
        if (order == null || order.getOrderId() == null) return;

        enqueueSafe(
                EmailEventType.ORDER_PAID,
                EmailAggregateType.ORDER,
                order.getOrderId(),
                normalizeEmail(order.getCustomerEmail()),
                LocalDateTime.now()
        );
    }

    // FIX-6: notifica cliente che il suo slot era già occupato e il pagamento verrà rimborsato
    public void enqueueBookingRefunded(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;

        enqueueSafe(
                EmailEventType.BOOKING_REFUNDED,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                normalizeEmail(booking.getCustomerEmail()),
                LocalDateTime.now()
        );
    }

    public void enqueuePaidConflictAlert(Booking booking, String stripeSessionId) {
        if (booking == null || booking.getBookingId() == null) return;
        String to = normalizeEmail(adminEmail);
        if (to == null) return;

        enqueueSafe(
                EmailEventType.PAID_CONFLICT,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                to,
                LocalDateTime.now()
        );
    }

    public void enqueueWaitlistNotification(WaitlistEntry entry) {
        if (entry == null || entry.getId() == null) return;

        enqueueSafe(
                EmailEventType.WAITLIST_SLOT_AVAILABLE,
                EmailAggregateType.WAITLIST,
                entry.getId(),
                normalizeEmail(entry.getCustomerEmail()),
                LocalDateTime.now()
        );
    }

    public void enqueueReviewRequest(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;

        enqueueSafe(
                EmailEventType.REVIEW_REQUEST,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                normalizeEmail(booking.getCustomerEmail()),
                LocalDateTime.now()
        );
    }

    private void enqueueSafe(
            EmailEventType eventType,
            EmailAggregateType aggregateType,
            java.util.UUID aggregateId,
            String toEmail,
            LocalDateTime scheduledAt
    ) {
        if (toEmail == null || toEmail.isBlank()) return;

        if (repo.existsByEventTypeAndAggregateTypeAndAggregateId(eventType, aggregateType, aggregateId)) return;

        EmailOutbox e = new EmailOutbox();
        e.setEventType(eventType);
        e.setAggregateType(aggregateType);
        e.setAggregateId(aggregateId);
        e.setToEmail(toEmail);
        e.setScheduledAt(scheduledAt);
        e.setStatus(EmailOutboxStatus.PENDING);

        try {
            repo.save(e);
        } catch (DataIntegrityViolationException dup) {
            // qualcuno l'ha inserita nello stesso istante
        }
    }

    private static String normalizeEmail(String email) {
        if (email == null) return null;
        String t = email.trim().toLowerCase();
        return t.isEmpty() ? null : t;
    }
}