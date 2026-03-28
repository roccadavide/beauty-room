package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.waitlistDTOs.WaitlistRequestDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.waitlistDTOs.WaitlistResponseDTO;
import daviderocca.CAPSTONE_BACKEND.email.outbox.EmailOutboxService;
import daviderocca.CAPSTONE_BACKEND.entities.WaitlistEntry;
import daviderocca.CAPSTONE_BACKEND.enums.WaitlistStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.repositories.WaitlistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class WaitlistService {

    private final WaitlistRepository    waitlistRepository;
    private final ServiceItemService    serviceItemService;
    private final EmailOutboxService    emailOutboxService;

    @Value("${app.front.url:http://localhost:5173}")
    private String frontUrl;

    private static final int TOKEN_EXPIRE_HOURS = 2;

    // ── Iscrizione lista d'attesa ──────────────────────────────────────
    @Transactional
    public WaitlistResponseDTO joinWaitlist(WaitlistRequestDTO req) {
        if (req.customerEmail() == null || req.customerEmail().isBlank())
            throw new BadRequestException("Email obbligatoria.");
        if (req.requestedDate() == null || req.requestedTime() == null)
            throw new BadRequestException("Data e ora obbligatorie.");

        var service = serviceItemService.findServiceItemById(req.serviceId());
        serviceItemService.assertServiceActive(service);

        String email = req.customerEmail().trim().toLowerCase();

        boolean alreadyIn = waitlistRepository
            .existsByServiceServiceIdAndRequestedDateAndRequestedTimeAndCustomerEmailIgnoreCaseAndStatusIn(
                req.serviceId(),
                req.requestedDate(),
                req.requestedTime(),
                email,
                List.of(WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED)
            );

        if (alreadyIn)
            throw new BadRequestException("Sei già in lista d'attesa per questo slot.");

        WaitlistEntry entry = new WaitlistEntry();
        entry.setService(service);
        entry.setRequestedDate(req.requestedDate());
        entry.setRequestedTime(req.requestedTime());
        entry.setCustomerName(req.customerName().trim());
        entry.setCustomerEmail(email);
        entry.setCustomerPhone(req.customerPhone().trim());
        entry.setStatus(WaitlistStatus.WAITING);

        WaitlistEntry saved = waitlistRepository.save(entry);
        log.info("Waitlist entry created: id={} email={} slot={} {}",
            saved.getId(), email, req.requestedDate(), req.requestedTime());

        int position = waitlistRepository
            .findByServiceServiceIdAndRequestedDateAndRequestedTimeOrderByCreatedAtAsc(
                req.serviceId(), req.requestedDate(), req.requestedTime())
            .size();

        return toDTO(saved, position);
    }

    // ── Notifica il primo in lista quando uno slot si libera ───────────
    @Transactional
    public void notifyNextInQueue(UUID serviceId, LocalDate date, LocalTime time) {
        Optional<WaitlistEntry> next = waitlistRepository
            .findFirstByServiceServiceIdAndRequestedDateAndRequestedTimeAndStatusOrderByCreatedAtAsc(
                serviceId, date, time, WaitlistStatus.WAITING);

        if (next.isEmpty()) return;

        WaitlistEntry entry = next.get();

        String token = UUID.randomUUID().toString().replace("-", "");
        entry.setToken(token);
        entry.setTokenExpiresAt(LocalDateTime.now().plusHours(TOKEN_EXPIRE_HOURS));
        entry.setStatus(WaitlistStatus.NOTIFIED);
        entry.setNotifiedAt(LocalDateTime.now());
        waitlistRepository.save(entry);

        emailOutboxService.enqueueWaitlistNotification(entry);

        log.info("Waitlist notified: id={} email={} slot={} {}",
            entry.getId(), entry.getCustomerEmail(), date, time);
    }

    // ── Verifica token e restituisce l'entry (senza marcarla BOOKED) ──
    @Transactional(readOnly = true)
    public WaitlistEntry consumeToken(String token) {
        WaitlistEntry entry = waitlistRepository.findByToken(token)
            .orElseThrow(() -> new BadRequestException("Token non valido."));

        if (entry.getStatus() != WaitlistStatus.NOTIFIED)
            throw new BadRequestException("Token già utilizzato o scaduto.");

        if (entry.getTokenExpiresAt().isBefore(LocalDateTime.now()))
            throw new BadRequestException("Il link è scaduto. Torna nella pagina del servizio per iscriverti nuovamente.");

        return entry;
    }

    @Transactional
    public void markAsBooked(UUID waitlistId) {
        waitlistRepository.findById(waitlistId).ifPresent(e -> {
            e.setStatus(WaitlistStatus.BOOKED);
            waitlistRepository.save(e);
        });
    }

    // ── Scheduler: scade i token non usati → notifica il prossimo ──────
    @Scheduled(fixedDelay = 600_000)
    @Transactional
    public void expireStaleTokensAndNotifyNext() {
        List<WaitlistEntry> stale = waitlistRepository
            .findByStatusAndTokenExpiresAtBefore(WaitlistStatus.NOTIFIED, LocalDateTime.now());

        for (WaitlistEntry e : stale) {
            UUID serviceId   = e.getService().getServiceId();
            LocalDate date   = e.getRequestedDate();
            LocalTime time   = e.getRequestedTime();

            e.setStatus(WaitlistStatus.EXPIRED);
            e.setToken(null);
            e.setTokenExpiresAt(null);
            waitlistRepository.save(e);
            log.info("Waitlist token expired: id={}", e.getId());

            notifyNextInQueue(serviceId, date, time);
        }
    }

    // ── Helper: deep link ──────────────────────────────────────────────
    public String buildBookingDeepLink(String token) {
        return frontUrl + "/prenotazione/waitlist?token=" + token;
    }

    private WaitlistResponseDTO toDTO(WaitlistEntry e, int position) {
        return new WaitlistResponseDTO(
            e.getId(),
            e.getRequestedDate(),
            e.getRequestedTime(),
            e.getService() != null ? e.getService().getTitle() : null,
            e.getStatus(),
            position
        );
    }
}
