package daviderocca.beautyroom.email.outbox;

import daviderocca.beautyroom.email.events.EmailAggregateType;
import daviderocca.beautyroom.email.events.EmailEventType;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Order;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.entities.WaitlistEntry;
import daviderocca.beautyroom.entities.WishlistItem;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmailOutboxService {

    private final EmailOutboxRepository repo;
    @Value("${app.admin.email:admin@beautyroom.local}")
    private String adminEmail;

    @Transactional
    public void enqueueBookingConfirmed(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;

        enqueueSafe(
                EmailEventType.BOOKING_CONFIRMED,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                recipientFor(booking),
                LocalDateTime.now()
        );

        enqueueBookingReminder24h(booking);
    }

    @Transactional
    public void enqueueBookingReminder24h(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;
        if (booking.getStartTime() == null) return;

        // RESCHEDULE-SAFE: drop any existing reminder so a moved booking re-schedules at the
        // new time (the unique constraint uk_email_event_agg would otherwise block the re-insert,
        // pinning the reminder to the stale time). Safe against duplicate sends: a reminder that
        // already fired implies the appointment is <=24h away, so the 25h guard below then
        // prevents re-creating it.
        repo.deleteByEventTypeAndAggregateTypeAndAggregateId(
                EmailEventType.BOOKING_REMINDER_24H, EmailAggregateType.BOOKING, booking.getBookingId());

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
                recipientFor(booking),
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

    // PROMPT A: rimborso ordine neutro confermato (concordato, NON slot occupato).
    public void enqueueOrderRefundConfirmed(Order order) {
        if (order == null || order.getOrderId() == null) return;

        enqueueSafe(
                EmailEventType.ORDER_REFUND_CONFIRMED,
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
                recipientFor(booking),
                LocalDateTime.now()
        );
    }

    // PROMPT A: rimborso prenotazione neutro confermato (concordato col cliente, NON slot occupato).
    public void enqueueBookingRefundConfirmed(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;

        enqueueSafe(
                EmailEventType.BOOKING_REFUND_CONFIRMED,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                recipientFor(booking),
                LocalDateTime.now()
        );
    }

    // PROMPT B: appuntamento spostato (from→to). Delete-first così ogni nuovo spostamento ri-invia:
    // il vincolo uk_email_event_agg bloccherebbe altrimenti il re-insert, lasciando la mail vecchia.
    @Transactional
    public void enqueueBookingRescheduled(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;

        repo.deleteByEventTypeAndAggregateTypeAndAggregateId(
                EmailEventType.BOOKING_RESCHEDULED, EmailAggregateType.BOOKING, booking.getBookingId());

        enqueueSafe(
                EmailEventType.BOOKING_RESCHEDULED,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                recipientFor(booking),
                LocalDateTime.now()
        );
    }

    // PROMPT B: appuntamento annullato (generico). Delete-first così una seconda cancellazione (o
    // entrambi i path cancelBooking/updateBookingStatus per la stessa cancellazione) restano una mail.
    @Transactional
    public void enqueueBookingCancelled(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;

        repo.deleteByEventTypeAndAggregateTypeAndAggregateId(
                EmailEventType.BOOKING_CANCELLED, EmailAggregateType.BOOKING, booking.getBookingId());

        enqueueSafe(
                EmailEventType.BOOKING_CANCELLED,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                recipientFor(booking),
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

    /** Notifica a Michela: nuovo utente registrato. */
    public void enqueueUserRegistered(User user) {
        if (user == null || user.getUserId() == null) return;
        String to = normalizeEmail(adminEmail);
        if (to == null) return;

        enqueueSafe(
                EmailEventType.USER_REGISTERED,
                EmailAggregateType.USER,
                user.getUserId(),
                to,
                LocalDateTime.now()
        );
    }

    public void enqueueReviewRequest(Booking booking) {
        if (booking == null || booking.getBookingId() == null) return;

        enqueueSafe(
                EmailEventType.REVIEW_REQUEST,
                EmailAggregateType.BOOKING,
                booking.getBookingId(),
                recipientFor(booking),
                LocalDateTime.now()
        );
    }

    /** Notifica all'utente che un item nella sua wishlist è tornato disponibile.
     *  Se esiste già una notifica pendente/inviata per questo item, la sostituisce
     *  per permettere ri-notifica su future ri-attivazioni. */
    @Transactional
    public void enqueueWishlistBackInStock(WishlistItem wishlistItem, String itemName) {
        if (wishlistItem == null || wishlistItem.getId() == null) return;
        String email = normalizeEmail(wishlistItem.getUser().getEmail());
        if (email == null) return;

        // Rimuove eventuale record precedente (SENT/FAILED/PENDING) così
        // la ri-attivazione dell'item genera sempre una nuova notifica.
        repo.deleteByEventTypeAndAggregateTypeAndAggregateId(
                EmailEventType.WISHLIST_BACK_IN_STOCK,
                EmailAggregateType.WISHLIST_ITEM,
                wishlistItem.getId()
        );

        EmailOutbox e = new EmailOutbox();
        e.setEventType(EmailEventType.WISHLIST_BACK_IN_STOCK);
        e.setAggregateType(EmailAggregateType.WISHLIST_ITEM);
        e.setAggregateId(wishlistItem.getId());
        e.setToEmail(email);
        e.setScheduledAt(LocalDateTime.now());
        e.setStatus(EmailOutboxStatus.PENDING);

        try {
            repo.save(e);
        } catch (DataIntegrityViolationException dup) {
            // race condition — già re-inserita
        }
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

    private static final String WALKIN_EMAIL_DOMAIN = "@beautyroom.local";

    /** Deliverable address test: not null/blank and not the technical walk-in
     *  address (walkin+…@beautyroom.local). Mirrors CustomerService's WALKIN_MARKER. */
    private boolean isRealEmail(String e) {
        return e != null && !e.isBlank() && !e.toLowerCase().contains(WALKIN_EMAIL_DOMAIN);
    }

    /** Resolves the booking recipient: the typed customerEmail first, then the linked
     *  account (customer → linkedUser → user). Returns null only for a true walk-in with
     *  no real address anywhere, in which case enqueueSafe skips the send (correct). */
    private String recipientFor(Booking b) {
        if (isRealEmail(b.getCustomerEmail())) return normalizeEmail(b.getCustomerEmail());
        if (b.getCustomer()   != null && isRealEmail(b.getCustomer().getEmail()))   return normalizeEmail(b.getCustomer().getEmail());
        if (b.getLinkedUser() != null && isRealEmail(b.getLinkedUser().getEmail())) return normalizeEmail(b.getLinkedUser().getEmail());
        if (b.getUser()       != null && isRealEmail(b.getUser().getEmail()))       return normalizeEmail(b.getUser().getEmail());
        return null;
    }

    private static String normalizeEmail(String email) {
        if (email == null) return null;
        String t = email.trim().toLowerCase();
        return t.isEmpty() ? null : t;
    }
}