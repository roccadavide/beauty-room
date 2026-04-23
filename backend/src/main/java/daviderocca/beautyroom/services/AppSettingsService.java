package daviderocca.beautyroom.services;

import daviderocca.beautyroom.entities.AppSettings;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.repositories.AppSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AppSettingsService {

    private static final String KEY_CANCELLATION_HOURS = "cancellation_hours_limit";
    private static final int DEFAULT_CANCELLATION_HOURS = 24;

    private final AppSettingsRepository repo;

    @Transactional(readOnly = true)
    public int getCancellationHoursLimit() {
        return repo.findById(KEY_CANCELLATION_HOURS)
                .map(s -> {
                    try { return Integer.parseInt(s.getValue()); }
                    catch (NumberFormatException e) { return DEFAULT_CANCELLATION_HOURS; }
                })
                .orElse(DEFAULT_CANCELLATION_HOURS);
    }

    @Transactional
    public void setCancellationHoursLimit(int hours) {
        if (hours < 0 || hours > 168) {
            throw new BadRequestException("Il limite di cancellazione deve essere compreso tra 0 e 168 ore.");
        }
        AppSettings s = repo.findById(KEY_CANCELLATION_HOURS).orElseGet(() -> {
            AppSettings n = new AppSettings();
            n.setKey(KEY_CANCELLATION_HOURS);
            return n;
        });
        s.setValue(String.valueOf(hours));
        repo.save(s);
        log.info("cancellation_hours_limit aggiornato a {}h", hours);
    }
}
