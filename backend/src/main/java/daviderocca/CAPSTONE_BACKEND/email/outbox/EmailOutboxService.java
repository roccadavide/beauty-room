package daviderocca.CAPSTONE_BACKEND.email.outbox;

import daviderocca.CAPSTONE_BACKEND.email.events.EmailAggregateType;
import daviderocca.CAPSTONE_BACKEND.email.events.EmailEventType;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.Order;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class EmailOutboxService {

    private final EmailOutboxRepository repo;

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