package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.email.provider.MailgunSender;
import daviderocca.CAPSTONE_BACKEND.email.templates.EmailContent;
import daviderocca.CAPSTONE_BACKEND.email.templates.EmailTemplateService;
import daviderocca.CAPSTONE_BACKEND.entities.StockAlert;
import daviderocca.CAPSTONE_BACKEND.repositories.StockAlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class StockAlertService {

    private final StockAlertRepository alertRepo;
    private final MailgunSender mailgunSender;
    private final EmailTemplateService emailTemplates;

    @Value("${app.front.url:http://localhost:5173}")
    private String frontUrl;

    /**
     * Registra un'email per ricevere notifica quando il prodotto torna disponibile.
     * Se l'email è già registrata per quel prodotto, lancia AlreadySubscribedException (409).
     */
    @Transactional
    public void subscribe(UUID productId, String email, String customerName) {
        if (email == null || email.isBlank()) return;
        String normalizedEmail = email.trim().toLowerCase();

        if (alertRepo.existsByProductIdAndEmailIgnoreCase(productId, normalizedEmail)) {
            throw new AlreadySubscribedException("Email già registrata per questo prodotto.");
        }

        StockAlert alert = new StockAlert();
        alert.setProductId(productId);
        alert.setEmail(normalizedEmail);
        alert.setCustomerName(customerName != null ? customerName.trim() : null);

        try {
            alertRepo.save(alert);
        } catch (DataIntegrityViolationException e) {
            log.debug("StockAlert duplicate race condition: productId={} email={}", productId, normalizedEmail);
        }
    }

    /**
     * Chiamato quando lo stock di un prodotto passa da 0 a > 0.
     * Invia email a tutti gli iscritti e li marca come notificati.
     */
    @Transactional
    public void notifyRestocked(UUID productId, String productName) {
        List<StockAlert> pending = alertRepo.findByProductIdAndNotifiedAtIsNull(productId);
        if (pending.isEmpty()) return;

        String productUrl = frontUrl + "/prodotti/" + productId;
        LocalDateTime now = LocalDateTime.now();

        for (StockAlert alert : pending) {
            try {
                EmailContent content = emailTemplates.productBackInStock(
                    alert.getCustomerName() != null ? alert.getCustomerName() : "Cliente",
                    productName,
                    productUrl,
                    alert.getEmail()
                );
                mailgunSender.sendHtml(alert.getEmail(), content.subject(), content.html(), content.text());
                alert.setNotifiedAt(now);
            } catch (Exception ex) {
                log.warn("StockAlert email failed: id={} email={} err={}", alert.getId(), alert.getEmail(), ex.getMessage());
            }
        }

        alertRepo.saveAll(pending);
        log.info("StockAlert: notified {} subscribers for product={}", pending.size(), productId);
    }

    public static class AlreadySubscribedException extends RuntimeException {
        public AlreadySubscribedException(String msg) { super(msg); }
    }
}
