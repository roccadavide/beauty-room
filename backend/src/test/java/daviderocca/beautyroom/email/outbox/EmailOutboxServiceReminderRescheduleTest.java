package daviderocca.beautyroom.email.outbox;

import daviderocca.beautyroom.email.events.EmailAggregateType;
import daviderocca.beautyroom.email.events.EmailEventType;
import daviderocca.beautyroom.entities.Booking;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * PROMPT 3d — the 24h reminder must reschedule when a booking is moved.
 *
 * {@code enqueueBookingReminder24h} now deletes any existing reminder row before
 * (re)enqueuing, so a moved booking gets a reminder at the NEW {@code start-24h} instead of
 * being pinned to the stale time by the {@code uk_email_event_agg} unique constraint.
 *
 * Pure Mockito unit test — no Spring context, no DB. {@code enqueueSafe}'s existence check
 * returns {@code false} on the default mock, so a {@code save()} means "a reminder was
 * (re)created". The mock can't model the unique constraint itself; instead it proves the
 * call contract: delete-then-enqueue on every call, with the schedule reflecting the guard.
 */
@ExtendWith(MockitoExtension.class)
class EmailOutboxServiceReminderRescheduleTest {

    @Mock
    EmailOutboxRepository repo;

    @InjectMocks
    EmailOutboxService service;

    /** (a) create → exactly one reminder at start − 24h. */
    @Test
    void create_enqueuesSingleReminderAtStartMinus24h() {
        UUID id = UUID.randomUUID();
        LocalDateTime start = LocalDateTime.now().plusDays(3); // well beyond the 25h guard

        service.enqueueBookingReminder24h(booking(id, start));

        // delete runs even on create (harmless no-op when nothing exists)
        verify(repo).deleteByEventTypeAndAggregateTypeAndAggregateId(
                EmailEventType.BOOKING_REMINDER_24H, EmailAggregateType.BOOKING, id);

        ArgumentCaptor<EmailOutbox> cap = ArgumentCaptor.forClass(EmailOutbox.class);
        verify(repo).save(cap.capture());
        EmailOutbox saved = cap.getValue();
        assertEquals(EmailEventType.BOOKING_REMINDER_24H, saved.getEventType());
        assertEquals(EmailAggregateType.BOOKING, saved.getAggregateType());
        assertEquals(id, saved.getAggregateId());
        assertEquals(start.minusHours(24), saved.getScheduledAt());
    }

    /** (b) move later → old reminder deleted, new one at the new start − 24h. */
    @Test
    void moveLater_deletesStaleThenReEnqueuesAtNewStartMinus24h() {
        UUID id = UUID.randomUUID();
        LocalDateTime oldStart = LocalDateTime.now().plusDays(2);
        LocalDateTime newStart = LocalDateTime.now().plusDays(6);

        service.enqueueBookingReminder24h(booking(id, oldStart)); // initial
        service.enqueueBookingReminder24h(booking(id, newStart)); // moved later

        // each call deletes before it saves: delete, save, delete, save
        InOrder ordered = inOrder(repo);
        ordered.verify(repo).deleteByEventTypeAndAggregateTypeAndAggregateId(
                EmailEventType.BOOKING_REMINDER_24H, EmailAggregateType.BOOKING, id);
        ordered.verify(repo).save(any(EmailOutbox.class));
        ordered.verify(repo).deleteByEventTypeAndAggregateTypeAndAggregateId(
                EmailEventType.BOOKING_REMINDER_24H, EmailAggregateType.BOOKING, id);
        ordered.verify(repo).save(any(EmailOutbox.class));

        ArgumentCaptor<EmailOutbox> cap = ArgumentCaptor.forClass(EmailOutbox.class);
        verify(repo, times(2)).save(cap.capture());
        List<EmailOutbox> saves = cap.getAllValues();
        assertEquals(oldStart.minusHours(24), saves.get(0).getScheduledAt());
        assertEquals(newStart.minusHours(24), saves.get(1).getScheduledAt());
    }

    /** (c) move to < 25h away → reminder deleted, none re-created. */
    @Test
    void moveWithin25h_deletesStaleAndDoesNotReCreate() {
        UUID id = UUID.randomUUID();
        LocalDateTime farStart = LocalDateTime.now().plusDays(3);
        LocalDateTime imminentStart = LocalDateTime.now().plusHours(10); // < 25h → guard returns

        service.enqueueBookingReminder24h(booking(id, farStart));      // initial: enqueues
        service.enqueueBookingReminder24h(booking(id, imminentStart)); // moved within 25h

        // delete ran on both calls; save ran only for the far booking (nothing re-created for the move)
        verify(repo, times(2)).deleteByEventTypeAndAggregateTypeAndAggregateId(
                EmailEventType.BOOKING_REMINDER_24H, EmailAggregateType.BOOKING, id);
        verify(repo, times(1)).save(any(EmailOutbox.class));
    }

    // ---- helpers ----

    private static Booking booking(UUID id, LocalDateTime start) {
        Booking b = new Booking();
        setField(b, "bookingId", id); // bookingId is @Setter(AccessLevel.NONE)
        b.setStartTime(start);
        b.setCustomerEmail("client@example.com");
        return b;
    }

    private static void setField(Object target, String field, Object value) {
        try {
            Field f = target.getClass().getDeclaredField(field);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("test setup: cannot set " + field, e);
        }
    }
}
