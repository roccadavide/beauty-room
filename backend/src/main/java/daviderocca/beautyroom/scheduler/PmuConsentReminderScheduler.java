package daviderocca.beautyroom.scheduler;

import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.NotificationType;
import daviderocca.beautyroom.repositories.AdminNotificationRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.services.AdminNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Invia una notifica admin ~1 ora prima di ogni appuntamento PMU
 * che non ha ancora il consenso firmato. Gira ogni 15 minuti.
 * Anti-duplicazione: crea al massimo una notifica per booking nelle ultime 2 ore.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class PmuConsentReminderScheduler {

    private final BookingRepository        bookingRepository;
    private final AdminNotificationRepository notifRepository;
    private final AdminNotificationService adminNotificationService;

    @Scheduled(fixedDelay = 900_000) // ogni 15 minuti
    @Transactional(readOnly = true)
    public void checkPmuConsents() {
        LocalDateTime now    = LocalDateTime.now();
        LocalDateTime from   = now.plusMinutes(30);
        LocalDateTime to     = now.plusMinutes(90);
        LocalDateTime cutoff = now.minusHours(2);

        List<Booking> pending = bookingRepository.findPmuUnsignedFuture(
                List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT),
                from, to
        );

        if (pending.isEmpty()) return;
        log.info("[PMU Consent Scheduler] {} prenotazioni PMU senza firma nel range +30/+90 min", pending.size());

        for (Booking b : pending) {
            boolean alreadyNotified = notifRepository.existsRecentForEntity(
                    NotificationType.PMU_CONSENT, b.getBookingId(), cutoff);

            if (alreadyNotified) {
                log.debug("[PMU Consent Scheduler] skip bookingId={} (notifica recente già presente)", b.getBookingId());
                continue;
            }

            long minutesUntil = ChronoUnit.MINUTES.between(now, b.getStartTime());
            String customerName = b.getCustomerName() != null ? b.getCustomerName() : "Cliente";
            String serviceTitle = (b.getService() != null && b.getService().getTitle() != null)
                    ? b.getService().getTitle() : "Trattamento PMU";

            String title = "✍️ Consenso PMU da firmare";
            String body  = String.format(
                    "Tra %d min: %s – %s. Ricordati di far firmare il consenso informato PMU!",
                    minutesUntil, customerName, serviceTitle
            );

            adminNotificationService.create(
                    NotificationType.PMU_CONSENT,
                    title,
                    body,
                    b.getBookingId(),
                    "BOOKING"
            );
            log.info("[PMU Consent Scheduler] Notifica creata per bookingId={}", b.getBookingId());
        }
    }
}
