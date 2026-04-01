package daviderocca.beautyroom.schedulers;

import daviderocca.beautyroom.email.outbox.EmailOutboxService;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.repositories.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@Slf4j
@RequiredArgsConstructor
public class ReviewRequestScheduler {

    private final BookingRepository  bookingRepository;
    private final EmailOutboxService emailOutboxService;

    /**
     * Ogni ora cerca prenotazioni COMPLETED tra 36h e 48h fa
     * senza richiesta recensione inviata.
     *
     * Finestra 36-48h: abbastanza tempo perché il trattamento
     * sia ricordato, ma non troppo tardi da perdere engagement.
     */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void sendPendingReviewRequests() {
        LocalDateTime now  = LocalDateTime.now();
        LocalDateTime from = now.minusHours(48);
        LocalDateTime to   = now.minusHours(36);

        List<Booking> candidates = bookingRepository
                .findCompletedBetweenWithoutReviewRequest(from, to);

        if (candidates.isEmpty()) return;

        log.info("ReviewRequestScheduler: {} prenotazioni candidate", candidates.size());

        int sent = 0;
        for (Booking booking : candidates) {
            try {
                emailOutboxService.enqueueReviewRequest(booking);
                booking.setReviewRequestSentAt(now);
                bookingRepository.save(booking);
                sent++;
            } catch (Exception e) {
                log.warn("Review request skipped for booking {}: {}",
                        booking.getBookingId(), e.getMessage());
            }
        }

        log.info("ReviewRequestScheduler: {} richieste recensione accodate", sent);
    }
}
