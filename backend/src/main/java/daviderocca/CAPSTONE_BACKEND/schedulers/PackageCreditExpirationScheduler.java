package daviderocca.CAPSTONE_BACKEND.schedulers;

import daviderocca.CAPSTONE_BACKEND.services.PackageCreditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Ogni notte alle 02:30 segna come EXPIRED tutti i PackageCredit ACTIVE
 * la cui expiryDate (purchasedAt + 24 mesi) è stata superata.
 *
 * Lo scheduler non cancella mai i record: i pacchetti EXPIRED restano
 * in DB per storico (regola 9).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PackageCreditExpirationScheduler {

    private final PackageCreditService packageCreditService;

    @Scheduled(cron = "0 30 2 * * *")
    public void expirePackageCredits() {
        int expired = packageCreditService.expireOverduePackages();
        if (expired > 0) {
            log.info("Scheduler: {} PackageCredit marcati EXPIRED.", expired);
        }
    }
}
