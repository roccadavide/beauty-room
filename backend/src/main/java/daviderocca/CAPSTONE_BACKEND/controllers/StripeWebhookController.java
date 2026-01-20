package daviderocca.CAPSTONE_BACKEND.controllers;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.*;
import com.stripe.model.checkout.Session;
import com.stripe.net.ApiResource;
import com.stripe.net.Webhook;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.PackageCredit;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.enums.OrderStatus;
import daviderocca.CAPSTONE_BACKEND.services.BookingService;
import daviderocca.CAPSTONE_BACKEND.services.OrderService;
import daviderocca.CAPSTONE_BACKEND.services.PackageCreditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/stripe")
@RequiredArgsConstructor
@Slf4j
public class StripeWebhookController {

    @Value("${stripe.webhook.secret}")
    private String endpointSecret;

    private final OrderService orderService;
    private final BookingService bookingService;
    private final PackageCreditService packageCreditService;

    @PostMapping("/webhook")
    public ResponseEntity<String> handleStripeEvent(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader
    ) {
        final Event event;

        try {
            event = Webhook.constructEvent(payload, sigHeader, endpointSecret);
        } catch (SignatureVerificationException e) {
            log.error("Verifica firma webhook fallita: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        }

        log.info("Stripe event: {}", event.getType());

        try {
            switch (event.getType()) {
                case "checkout.session.completed" -> handleCheckoutCompleted(event);
                case "payment_intent.payment_failed" -> handlePaymentFailed(event);
                case "charge.refunded" -> handleChargeRefunded(event);
                default -> log.info("Evento non gestito: {}", event.getType());
            }
        } catch (Exception e) {
            log.error("Errore gestione Stripe {}: {}", event.getType(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error processing event");
        }

        return ResponseEntity.ok("success");
    }

    private void handleCheckoutCompleted(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();

        Session session = null;

        StripeObject obj = deserializer.getObject().orElse(null);
        if (obj instanceof Session) {
            session = (Session) obj;
        }

        if (session == null) {
            String rawJson = deserializer.getRawJson();
            if (rawJson != null && !rawJson.isBlank()) {
                session = ApiResource.GSON.fromJson(rawJson, Session.class);
            }
        }

        if (session == null) {
            log.warn("checkout.session.completed senza Session (deserialization failed). eventId={} apiVersion={}",
                    event.getId(), event.getApiVersion());
            return;
        }

        log.info("checkout.session.completed OK: sessionId={} paymentStatus={}",
                session.getId(), session.getPaymentStatus());

        Map<String, String> metadata = session.getMetadata();
        String orderIdStr = metadata != null ? metadata.get("orderId") : null;
        String bookingIdStr = metadata != null ? metadata.get("bookingId") : null;

        String customerEmail = session.getCustomerDetails() != null
                ? session.getCustomerDetails().getEmail()
                : "unknown";

        // ===== ORDER =====
        if (orderIdStr != null) {
            UUID orderId = UUID.fromString(orderIdStr);
            orderService.markOrderAsPaid(orderId, customerEmail);
            log.info("Pagamento completato per ordine {} (cliente: {})", orderId, customerEmail);
            return;
        }

        // ===== BOOKING =====
        if (bookingIdStr != null) {
            UUID bookingId = UUID.fromString(bookingIdStr);

            // safety: accetta solo se Stripe la considera pagata
            String paymentStatus = session.getPaymentStatus(); // "paid", "unpaid", ...
            if (!"paid".equalsIgnoreCase(paymentStatus)) {
                log.warn("checkout.session.completed ma paymentStatus={} (skip) sessionId={}",
                        paymentStatus, session.getId());
                return;
            }

            Booking b = bookingService.findBookingById(bookingId);
            log.info("BEFORE confirm: bookingId={} status={} expiresAt={}",
                    b.getBookingId(), b.getBookingStatus(), b.getExpiresAt());

            // idempotenza
            if (b.getBookingStatus() == BookingStatus.CONFIRMED || b.getBookingStatus() == BookingStatus.COMPLETED) {
                log.info("Booking già confermato: bookingId={} status={}", bookingId, b.getBookingStatus());
            } else {
                boolean expiredOrCancelled =
                        b.getBookingStatus() == BookingStatus.CANCELLED ||
                                (b.getExpiresAt() != null && b.getExpiresAt().isBefore(LocalDateTime.now()));

                if (expiredOrCancelled) {
                    boolean conflict = bookingService.hasBlockingConflictExcluding(b);

                    if (conflict) {
                        b.setBookingStatus(BookingStatus.CANCELLED);
                        b.setCanceledAt(LocalDateTime.now());
                        b.setCancelReason("PAID_CONFLICT");
                        b.setExpiresAt(null);
                        bookingService.save(b);

                        log.error("PAID_CONFLICT: bookingId={} sessionId={} slot già occupato. Necessario intervento (refund/manual).",
                                bookingId, session.getId());
                        return;
                    }

                    bookingService.confirmPaidBookingFromWebhook(b, customerEmail);

                    log.warn("Booking pagato dopo scadenza/cancel: riconfermato bookingId={} sessionId={}",
                            bookingId, session.getId());
                } else {
                    bookingService.confirmPaidBookingFromWebhook(b, customerEmail);
                }
            }

            // IMPORTANTISSIMO: ricarica dal DB dopo la confirm, così non risalvi uno snapshot vecchio dopo
            b = bookingService.findBookingById(bookingId);
            log.info("AFTER confirm (fresh): bookingId={} status={} paidAt={}",
                    b.getBookingId(), b.getBookingStatus(), b.getPaidAt());

            // ===== PACCHETTI =====
            int sessionsTotal = 1;
            if (b.getServiceOption() != null && b.getServiceOption().getSessions() != null) {
                sessionsTotal = b.getServiceOption().getSessions();
            }

            if (sessionsTotal > 1) {
                boolean alreadyCreated = packageCreditService.findByStripeSessionId(session.getId()).isPresent();
                boolean alreadyLinked = (b.getPackageCredit() != null);

                if (alreadyCreated || alreadyLinked) {
                    log.warn("Skip pacchetto: alreadyCreated={} alreadyLinked={} bookingId={} stripeSessionId={}",
                            alreadyCreated, alreadyLinked, b.getBookingId(), session.getId());
                } else {
                    PackageCredit pc = packageCreditService.createPackageCredit(
                            b.getCustomerEmail(),
                            sessionsTotal,
                            b.getService(),
                            b.getServiceOption(),
                            b.getUser(),
                            session.getId(),
                            true
                    );

                    // ricarica ancora per essere super-safe prima del save finale
                    b = bookingService.findBookingById(bookingId);
                    b.setPackageCredit(pc);
                    bookingService.save(b);

                    log.info("Pacchetto creato e collegato: bookingId={} packageCreditId={} total={} remaining={}",
                            b.getBookingId(), pc.getPackageCreditId(), pc.getSessionsTotal(), pc.getSessionsRemaining());
                }
            }

            log.info("Pagamento completato per booking {} (cliente: {})", bookingId, customerEmail);
            return;
        }

        log.warn("checkout.session.completed senza orderId/bookingId in metadata");
    }

    private void handlePaymentFailed(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        PaymentIntent intent = (PaymentIntent) deserializer.getObject().orElse(null);

        if (intent == null) {
            log.warn("payment_intent.payment_failed senza PaymentIntent");
            return;
        }

        String orderIdStr = intent.getMetadata() != null ? intent.getMetadata().get("orderId") : null;
        if (orderIdStr == null) {
            log.info("payment_intent.payment_failed: non è ordine (ok ignorare)");
            return;
        }

        UUID orderId = UUID.fromString(orderIdStr);
        orderService.updateOrderStatus(orderId, OrderStatus.FAILED);
        log.warn("Pagamento fallito per ordine {}", orderId);
    }

    private void handleChargeRefunded(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        Charge charge = (Charge) deserializer.getObject().orElse(null);

        if (charge == null) {
            log.warn("charge.refunded senza Charge");
            return;
        }

        String orderIdStr = charge.getMetadata() != null ? charge.getMetadata().get("orderId") : null;
        if (orderIdStr == null) {
            log.info("charge.refunded: non è ordine (se vuoi, gestire refund booking in futuro)");
            return;
        }

        UUID orderId = UUID.fromString(orderIdStr);
        orderService.updateOrderStatus(orderId, OrderStatus.REFUNDED);
        log.info("Rimborso completato per ordine {}", orderId);
    }
}