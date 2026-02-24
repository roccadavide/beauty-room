package daviderocca.CAPSTONE_BACKEND.schedulers;

import daviderocca.CAPSTONE_BACKEND.services.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderExpirationScheduler {

    private final OrderService orderService;

    @Scheduled(fixedDelay = 120_000)
    public void expirePendingOrders() {
        int expired = orderService.expirePendingOrders();
        if (expired > 0) log.info("Scheduler expired pending orders: {}", expired);
    }
}
