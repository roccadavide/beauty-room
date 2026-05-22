package daviderocca.beautyroom.scheduler;

import daviderocca.beautyroom.entities.Closure;
import daviderocca.beautyroom.enums.NotificationType;
import daviderocca.beautyroom.repositories.AdminNotificationRepository;
import daviderocca.beautyroom.repositories.ClosureRepository;
import daviderocca.beautyroom.services.AdminNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Emits a "day-before" in-app notification for every closure starting tomorrow.
 *
 * Runs once a day at 18:00 Europe/Rome — quiet, simple, idempotent.
 *
 * Safety net: when a closure is created or updated with startDate within
 * tomorrow, ClosureService also calls {@link #emitReminderForTomorrowIfApplicable}
 * so a closure created after the daily run still gets a reminder.
 *
 * Anti-duplication: relies on {@code existsRecentForEntity} in the last 20 hours,
 * which fits the daily cadence and the rare manual-fire path.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class ClosureReminderScheduler {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Europe/Rome");
    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter ITA_DATE =
            DateTimeFormatter.ofPattern("d MMMM", Locale.ITALIAN);

    private final ClosureRepository closureRepository;
    private final AdminNotificationService adminNotificationService;
    private final AdminNotificationRepository notifRepository;

    @Scheduled(cron = "0 0 18 * * *", zone = "Europe/Rome")
    @Transactional(readOnly = true)
    public void emitDailyReminders() {
        LocalDate tomorrow = LocalDate.now(BUSINESS_ZONE).plusDays(1);
        List<Closure> startingTomorrow = closureRepository.findByStartDate(tomorrow);
        if (startingTomorrow.isEmpty()) return;

        log.info("[Closure reminder] {} closures starting {}", startingTomorrow.size(), tomorrow);

        LocalDateTime cutoff = LocalDateTime.now().minusHours(20);
        for (Closure c : startingTomorrow) {
            if (notifRepository.existsRecentForEntity(
                    NotificationType.CLOSURE_REMINDER, c.getId(), cutoff)) {
                continue;
            }
            emitReminderFor(c);
        }
    }

    /**
     * Manual fire path — called from ClosureService on create / update.
     * No-op unless the closure starts tomorrow (the date the daily run covers).
     */
    public void emitReminderForTomorrowIfApplicable(Closure c) {
        if (c == null || c.getStartDate() == null) return;
        LocalDate tomorrow = LocalDate.now(BUSINESS_ZONE).plusDays(1);
        if (!c.getStartDate().equals(tomorrow)) return;

        LocalDateTime cutoff = LocalDateTime.now().minusHours(20);
        if (notifRepository.existsRecentForEntity(
                NotificationType.CLOSURE_REMINDER, c.getId(), cutoff)) {
            return;
        }
        emitReminderFor(c);
        log.info("[Closure reminder] immediate fire for closure {} starting tomorrow", c.getId());
    }

    // ---------------------------------- INTERNAL ----------------------------------

    private void emitReminderFor(Closure c) {
        String title = "Chiusura programmata domani";
        String body  = buildBody(c);

        adminNotificationService.create(
                NotificationType.CLOSURE_REMINDER,
                title,
                body,
                c.getId(),
                "CLOSURE"
        );
    }

    private String buildBody(Closure c) {
        String reason = c.getReason() != null ? c.getReason() : "";
        if (c.isMultiDay()) {
            return String.format("Da domani in chiusura fino al %s: %s.",
                    c.getEndDate().format(ITA_DATE), reason);
        }
        if (c.isFullDay()) {
            return String.format("Domani sei in chiusura: %s.", reason);
        }
        return String.format("Domani sei in chiusura dalle %s alle %s: %s.",
                c.getStartTime().format(HHMM), c.getEndTime().format(HHMM), reason);
    }
}
