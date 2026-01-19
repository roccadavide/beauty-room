package daviderocca.CAPSTONE_BACKEND.schedulers;

import daviderocca.CAPSTONE_BACKEND.services.BookingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class BookingHoldScheduler {

    private final BookingService bookingService;

    // ogni 1 minuto: perfetto per hold da 10-15 min
    @Scheduled(fixedDelay = 60_000)
    public void expireHolds() {
        int expired = bookingService.expirePendingBookings();
        if (expired > 0) log.info("Scheduler expired holds: {}", expired);
    }
}