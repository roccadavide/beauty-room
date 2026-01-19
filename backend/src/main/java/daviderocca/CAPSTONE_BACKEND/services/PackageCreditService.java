package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.entities.PackageCredit;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceOption;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.PackageCreditStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.repositories.PackageCreditRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class PackageCreditService {

    private final PackageCreditRepository packageCreditRepository;

    @Transactional
    public PackageCredit createPackageCredit(
            String customerEmail,
            int sessionsTotal,
            ServiceItem service,
            ServiceOption option,
            User userOrNull,
            String stripeSessionId,
            boolean consumeFirstSession
    ) {
        if (customerEmail == null || customerEmail.trim().isEmpty()) throw new BadRequestException("Email cliente obbligatoria.");
        if (sessionsTotal <= 1) throw new BadRequestException("sessionsTotal deve essere > 1 per creare un pacchetto.");

        PackageCredit pc = new PackageCredit();
        pc.setCustomerEmail(customerEmail.trim().toLowerCase());
        pc.setSessionsTotal(sessionsTotal);

        int remaining = sessionsTotal - (consumeFirstSession ? 1 : 0);
        if (remaining < 0) remaining = 0;

        pc.setSessionsRemaining(remaining);
        pc.setStatus(remaining == 0 ? PackageCreditStatus.EXHAUSTED : PackageCreditStatus.ACTIVE);
        pc.setService(service);
        pc.setServiceOption(option);
        pc.setUser(userOrNull);
        pc.setStripeSessionId(stripeSessionId);

        PackageCredit saved = packageCreditRepository.save(pc);
        log.info("PackageCredit created: id={} email={} total={} remaining={}",
                saved.getPackageCreditId(), saved.getCustomerEmail(), saved.getSessionsTotal(), saved.getSessionsRemaining());
        return saved;
    }

    @Transactional
    public void consumeOne(UUID packageCreditId) {
        PackageCredit pc = packageCreditRepository.findById(packageCreditId)
                .orElseThrow(() -> new BadRequestException("Pacchetto non trovato."));

        if (pc.getStatus() != PackageCreditStatus.ACTIVE) {
            throw new BadRequestException("Pacchetto non attivo.");
        }
        if (pc.getSessionsRemaining() <= 0) {
            pc.setStatus(PackageCreditStatus.EXHAUSTED);
            packageCreditRepository.save(pc);
            throw new BadRequestException("Nessuna seduta residua nel pacchetto.");
        }

        pc.setSessionsRemaining(pc.getSessionsRemaining() - 1);
        if (pc.getSessionsRemaining() == 0) pc.setStatus(PackageCreditStatus.EXHAUSTED);

        packageCreditRepository.save(pc);
        log.info("PackageCredit consumed: id={} remaining={}", pc.getPackageCreditId(), pc.getSessionsRemaining());
    }

    @Transactional(readOnly = true)
    public Optional<PackageCredit> findByStripeSessionId(String stripeSessionId) {
        if (stripeSessionId == null || stripeSessionId.trim().isEmpty()) return Optional.empty();
        return packageCreditRepository.findByStripeSessionId(stripeSessionId.trim());
    }
}