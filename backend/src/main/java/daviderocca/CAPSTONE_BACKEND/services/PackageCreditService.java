package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.packageDTOs.ActivePackageDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.PackageCredit;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceOption;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.PackageCreditStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.DuplicateResourceException;
import daviderocca.CAPSTONE_BACKEND.repositories.PackageCreditRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class PackageCreditService {

    private final PackageCreditRepository packageCreditRepository;

    // =====================================================================
    // CREAZIONE
    // =====================================================================

    /**
     * Crea un nuovo PackageCredit.
     * Regola 1: un cliente non può avere due pacchetti ACTIVE sulla stessa ServiceOption.
     * L'expiryDate viene impostata a purchasedAt + 24 mesi in @PrePersist sull'entità.
     *
     * @param consumeFirstSession se true, la prima seduta viene subito scalata
     *                            (es. pagamento Stripe che include la seduta corrente)
     */
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
        if (customerEmail == null || customerEmail.isBlank()) {
            throw new BadRequestException("Email cliente obbligatoria.");
        }
        if (sessionsTotal <= 1) {
            throw new BadRequestException("sessionsTotal deve essere > 1 per creare un pacchetto.");
        }
        if (option == null) {
            throw new BadRequestException("Every package must be associated with a specific ServiceOption.");
        }

        String email = customerEmail.trim().toLowerCase();

        // Regola 5: blocco doppio pacchetto sulla stessa ServiceOption
        if (option != null) {
            boolean duplicateActive = packageCreditRepository
                    .existsByCustomerEmailIgnoreCaseAndServiceOptionOptionIdAndStatus(
                            email, option.getOptionId(), PackageCreditStatus.ACTIVE);
            if (duplicateActive) {
                throw new DuplicateResourceException(
                        "Esiste già un pacchetto ACTIVE per questa ServiceOption e questo cliente.");
            }
        }

        int remaining = sessionsTotal - (consumeFirstSession ? 1 : 0);
        if (remaining < 0) remaining = 0;

        PackageCredit pc = new PackageCredit();
        pc.setCustomerEmail(email);
        pc.setSessionsTotal(sessionsTotal);
        pc.setSessionsRemaining(remaining);
        pc.setStatus(remaining == 0 ? PackageCreditStatus.COMPLETED : PackageCreditStatus.ACTIVE);
        pc.setService(service);
        pc.setServiceOption(option);
        pc.setUser(userOrNull);
        pc.setStripeSessionId(stripeSessionId);

        PackageCredit saved = packageCreditRepository.save(pc);
        log.info("PackageCredit created: id={} email={} total={} remaining={} status={}",
                saved.getPackageCreditId(), saved.getCustomerEmail(),
                saved.getSessionsTotal(), saved.getSessionsRemaining(), saved.getStatus());
        return saved;
    }

    // =====================================================================
    // SCALATURA SEDUTA (chiamata da BookingService al cambio di stato)
    // =====================================================================

    /**
     * Scala una seduta dal pacchetto collegato alla prenotazione.
     * Chiamare quando: old != COMPLETED && new == COMPLETED.
     *
     * Protezioni:
     *  - packageCredit null → no-op
     *  - status != ACTIVE → no-op (non tocca pacchetti già COMPLETED/EXPIRED)
     *  - sessionsRemaining <= 0 → no-op con warning
     *
     * Usa SELECT … FOR UPDATE per evitare race condition su richieste concorrenti.
     */
    @Transactional
    public void consumeSessionForBooking(Booking booking) {
        if (booking.getPackageCredit() == null) return;

        UUID pcId = booking.getPackageCredit().getPackageCreditId();

        // lock pessimistico
        PackageCredit pc = packageCreditRepository.findByIdForUpdate(pcId)
                .orElseThrow(() -> new BadRequestException("PackageCredit non trovato: " + pcId));

        LocalDateTime expiry = pc.getExpiryDate();
        LocalDateTime bookingCreatedAt = booking.getCreatedAt();

        // Business rule / grace period:
        // - Se il pacchetto è già EXPIRED, la seduta viene comunque onorata se
        //   la prenotazione è stata CREATA prima della data di scadenza,
        //   indipendentemente da quando avviene effettivamente l'appuntamento.
        // - Il contratto viene considerato “chiuso” al momento della creazione
        //   della booking, non alla data del trattamento.
        // IMPORTANT:
        //   Non cambiare questa logica per usare startTime o LocalDateTime.now():
        //   è coperta dai test TC-EXPIRED-GRACE e TC-EXPIRED-NO-GRACE.
        if (pc.getStatus() == PackageCreditStatus.EXPIRED && expiry != null && bookingCreatedAt != null) {
            if (!bookingCreatedAt.isBefore(expiry)) {
                throw new BadRequestException("Il pacchetto è scaduto e non può essere usato per questa prenotazione.");
            }
        }

        if (pc.getStatus() != PackageCreditStatus.ACTIVE && pc.getStatus() != PackageCreditStatus.EXPIRED) {
            log.warn("consumeSession ignorato: pacchetto {} in stato {}", pcId, pc.getStatus());
            return;
        }
        if (pc.getSessionsRemaining() <= 0) {
            log.warn("consumeSession ignorato: pacchetto {} sessionsRemaining già 0", pcId);
            pc.setStatus(PackageCreditStatus.COMPLETED);
            packageCreditRepository.save(pc);
            return;
        }

        pc.setSessionsRemaining(pc.getSessionsRemaining() - 1);
        if (pc.getSessionsRemaining() == 0) {
            pc.setStatus(PackageCreditStatus.COMPLETED);
        }

        packageCreditRepository.save(pc);
        log.info("PackageCredit {} seduta scalata — remaining={} status={}",
                pcId, pc.getSessionsRemaining(), pc.getStatus());
    }

    /**
     * Ripristina una seduta nel pacchetto collegato alla prenotazione (rollback).
     * Chiamare quando: old == COMPLETED && new != COMPLETED.
     *
     * Non esiste un tetto massimo al restore: l'admin è responsabile.
     * Se il pacchetto era COMPLETED, torna ACTIVE.
     */
    @Transactional
    public void restoreSessionForBooking(Booking booking) {
        if (booking.getPackageCredit() == null) return;

        UUID pcId = booking.getPackageCredit().getPackageCreditId();

        // lock pessimistico
        PackageCredit pc = packageCreditRepository.findByIdForUpdate(pcId)
                .orElseThrow(() -> new BadRequestException("PackageCredit non trovato: " + pcId));

        // Protezione contro over-credit: non superare mai sessionsTotal
        if (pc.getSessionsRemaining() >= pc.getSessionsTotal()) {
            log.warn("restoreSession ignorato: pacchetto {} ha già sessionsRemaining >= sessionsTotal ({} >= {})",
                    pcId, pc.getSessionsRemaining(), pc.getSessionsTotal());
            return;
        }

        pc.setSessionsRemaining(pc.getSessionsRemaining() + 1);

        // se era COMPLETED, il ripristino lo riporta in ACTIVE
        if (pc.getStatus() == PackageCreditStatus.COMPLETED) {
            pc.setStatus(PackageCreditStatus.ACTIVE);
        }

        packageCreditRepository.save(pc);
        log.info("PackageCredit {} seduta ripristinata (rollback) — remaining={} status={}",
                pcId, pc.getSessionsRemaining(), pc.getStatus());
    }

    // =====================================================================
    // VALIDAZIONE PRENOTAZIONE CON PACCHETTO
    // =====================================================================

    /**
     * Valida che un pacchetto sia utilizzabile per la prenotazione fornita.
     * Da chiamare alla creazione della prenotazione se packageCreditId è presente.
     *
     * Regola 6:
     *  - status == ACTIVE
     *  - sessionsRemaining > 0
     *  - serviceOption coerente con quella della prenotazione
     */
    @Transactional(readOnly = true)
    public void validateBookingWithPackage(Booking booking) {
        PackageCredit pc = booking.getPackageCredit();
        if (pc == null) return;

        // eager expiry: il pacchetto potrebbe essere scaduto ma non ancora aggiornato dallo scheduler
        if (pc.getStatus() == PackageCreditStatus.ACTIVE
                && pc.getExpiryDate() != null
                && pc.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Il pacchetto è scaduto (expiryDate superata).");
        }

        if (pc.getStatus() != PackageCreditStatus.ACTIVE) {
            throw new BadRequestException(
                    "Il pacchetto non è utilizzabile: stato " + pc.getStatus());
        }
        if (pc.getSessionsRemaining() <= 0) {
            throw new BadRequestException("Il pacchetto non ha sedute residue.");
        }

        // verifica coerenza serviceOption
        ServiceOption bookingOption = booking.getServiceOption();
        ServiceOption pcOption     = pc.getServiceOption();

        if (bookingOption != null && pcOption != null
                && !bookingOption.getOptionId().equals(pcOption.getOptionId())) {
            throw new BadRequestException(
                    "Il pacchetto non è valido per la ServiceOption selezionata.");
        }
    }

    // =====================================================================
    // SCADENZA (usato anche dallo scheduler)
    // =====================================================================

    /**
     * Marca come EXPIRED tutti i PackageCredit ACTIVE con expiryDate passata.
     *
     * @return numero di pacchetti aggiornati
     */
    @Transactional
    public int expireOverduePackages() {
        List<PackageCredit> overdue = packageCreditRepository
                .findByStatusAndExpiryDateBefore(PackageCreditStatus.ACTIVE, LocalDateTime.now());

        for (PackageCredit pc : overdue) {
            pc.setStatus(PackageCreditStatus.EXPIRED);
        }

        if (!overdue.isEmpty()) {
            packageCreditRepository.saveAll(overdue);
            log.info("PackageCredit scaduti marcati EXPIRED: {}", overdue.size());
        }
        return overdue.size();
    }

    // =====================================================================
    // LOOKUP
    // =====================================================================

    @Transactional(readOnly = true)
    public PackageCredit findById(UUID id) {
        return packageCreditRepository.findById(id)
                .orElseThrow(() -> new BadRequestException("PackageCredit non trovato: " + id));
    }

    @Transactional(readOnly = true)
    public Optional<PackageCredit> findByStripeSessionId(String stripeSessionId) {
        if (stripeSessionId == null || stripeSessionId.isBlank()) return Optional.empty();
        return packageCreditRepository.findByStripeSessionId(stripeSessionId.trim());
    }

    /**
     * Recupera il pacchetto ACTIVE più vecchio (FIFO) per email + serviceOption.
     * Utile per futuri flow automatici di selezione pacchetto.
     */
    @Transactional(readOnly = true)
    public Optional<PackageCredit> findOldestActiveForEmailAndOption(String email, UUID optionId) {
        if (email == null || optionId == null) return Optional.empty();
        return packageCreditRepository
                .findTopByCustomerEmailIgnoreCaseAndServiceOptionOptionIdAndStatusOrderByPurchasedAtAsc(
                        email.trim().toLowerCase(), optionId, PackageCreditStatus.ACTIVE);
    }

    // =====================================================================
    // VISTA GLOBALE ADMIN
    // =====================================================================

    @Transactional(readOnly = true)
    public List<ActivePackageDTO> findAllActiveForAdmin() {
        List<PackageCreditStatus> statuses = List.of(
                PackageCreditStatus.ACTIVE,
                PackageCreditStatus.EXPIRED
        );

        return packageCreditRepository
                .findAllByStatusInOrderByExpiryDateAsc(statuses)
                .stream()
                .map(this::toActiveDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getPackageKpis() {
        return Map.of(
                "active",    packageCreditRepository.countByStatus(PackageCreditStatus.ACTIVE),
                "expired",   packageCreditRepository.countByStatus(PackageCreditStatus.EXPIRED),
                "completed", packageCreditRepository.countByStatus(PackageCreditStatus.COMPLETED)
        );
    }

    private ActivePackageDTO toActiveDTO(PackageCredit pc) {
        String customerName  = null;
        String customerPhone = null;

        if (pc.getUser() != null) {
            customerName  = pc.getUser().getName();
            customerPhone = pc.getUser().getPhone();
        }

        return new ActivePackageDTO(
                pc.getPackageCreditId(),
                pc.getCustomerEmail(),
                customerName,
                customerPhone,
                pc.getService() != null ? pc.getService().getTitle() : null,
                pc.getServiceOption() != null ? pc.getServiceOption().getName() : null,
                pc.getSessionsTotal(),
                pc.getSessionsRemaining(),
                pc.getStatus(),
                pc.getPurchasedAt(),
                pc.getExpiryDate()
        );
    }
}
