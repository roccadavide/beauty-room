package daviderocca.CAPSTONE_BACKEND.controllers;

import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.*;
import com.stripe.model.Refund;
import com.stripe.param.RefundCreateParams;
import com.stripe.model.checkout.Session;
import com.stripe.net.ApiResource;
import com.stripe.net.Webhook;
import daviderocca.CAPSTONE_BACKEND.email.outbox.EmailOutboxService;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.Order;
import daviderocca.CAPSTONE_BACKEND.entities.PackageCredit;
import daviderocca.CAPSTONE_BACKEND.entities.ProcessedStripeEvent;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.ProcessedStripeEventRepository;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.enums.OrderStatus;
import daviderocca.CAPSTONE_BACKEND.services.BookingService;
import daviderocca.CAPSTONE_BACKEND.services.OrderService;
import daviderocca.CAPSTONE_BACKEND.services.PackageCreditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
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

    // FIX-6: necessario per chiamare Stripe Refund API nel blocco PAID_CONFLICT
    @Value("${stripe.secret}")
    private String stripeSecretKey;

    private final OrderService orderService;
    private final BookingService bookingService;
    private final PackageCreditService packageCreditService;
    private final EmailOutboxService emailOutboxService;
    private final BookingRepository bookingRepository;
    private final ProcessedStripeEventRepository processedEventRepo;

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
            processedEventRepo.save(new ProcessedStripeEvent(event.getId()));

            switch (event.getType()) {
                case "checkout.session.completed" -> handleCheckoutCompleted(event);
                case "checkout.session.expired"   -> handleCheckoutExpired(event);
                case "payment_intent.payment_failed" -> handlePaymentFailed(event);
                case "charge.refunded"            -> handleChargeRefunded(event);
                default -> log.info("Evento non gestito: {}", event.getType());
            }

        } catch (DataIntegrityViolationException dup) {
            log.info("Stripe event già processato, skip: {}", event.getId());
            return ResponseEntity.ok("duplicate");
        } catch (Exception e) {
            log.error("Errore gestione Stripe {}: {}", event.getType(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error processing event");
        }

        return ResponseEntity.ok("success");
    }

    private void handleCheckoutCompleted(Event event) {
        Session session = deserializeSession(event);
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

        // accetta solo se Stripe la considera pagata
        String paymentStatus = session.getPaymentStatus();
        if (!"paid".equalsIgnoreCase(paymentStatus)) {
            log.warn("checkout.session.completed ma paymentStatus={} (skip) sessionId={}",
                    paymentStatus, session.getId());
            return;
        }

        // ===== ORDER =====
        if (orderIdStr != null) {
            UUID orderId = UUID.fromString(orderIdStr);

            // segna pagato
            orderService.markOrderAsPaid(orderId, customerEmail);
            Order o = orderService.findOrderById(orderId);
            emailOutboxService.enqueueOrderPaid(o);

            log.info("Pagamento completato per ordine {} (cliente: {})", orderId, customerEmail);
            return;
        }

        // ===== BOOKING =====
        if (bookingIdStr != null) {
            UUID bookingId = UUID.fromString(bookingIdStr);

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

                        log.error("PAID_CONFLICT: bookingId={} sessionId={} slot già occupato — avvio rimborso automatico.",
                                bookingId, session.getId());

                        // FIX-6: rimborso automatico Stripe quando lo slot è già occupato
                        try {
                            Stripe.apiKey = stripeSecretKey;
                            String paymentIntentId = session.getPaymentIntent();
                            if (paymentIntentId != null && !paymentIntentId.isBlank()) {
                                RefundCreateParams refundParams = RefundCreateParams.builder()
                                        .setPaymentIntent(paymentIntentId)
                                        .build();
                                Refund.create(refundParams);
                                log.info("PAID_CONFLICT: rimborso Stripe creato per bookingId={} pi={}",
                                        bookingId, paymentIntentId);
                            } else {
                                log.error("PAID_CONFLICT: payment_intent assente nella sessione, rimborso manuale necessario. sessionId={}",
                                        session.getId());
                            }
                        } catch (StripeException ex) {
                            log.error("PAID_CONFLICT: errore rimborso Stripe per bookingId={}: {}", bookingId, ex.getMessage());
                            booking.setCancelReason("PAID_CONFLICT_REFUND_FAILED");
                            bookingRepository.save(booking);
                        }

                        // FIX-6: alert admin
                        try {
                            emailOutboxService.enqueuePaidConflictAlert(b, session.getId());
                        } catch (Exception ex) {
                            log.error("Failed to enqueue PAID_CONFLICT alert email: {}", ex.getMessage());
                        }

                        // FIX-6: notifica cliente — rimborso in arrivo
                        try {
                            emailOutboxService.enqueueBookingRefunded(b);
                        } catch (Exception ex) {
                            log.error("Failed to enqueue BOOKING_REFUNDED customer email: {}", ex.getMessage());
                        }

                        return;
                    }

                    bookingService.confirmPaidBookingFromWebhook(b, customerEmail);
                    log.warn("Booking pagato dopo scadenza/cancel: riconfermato bookingId={} sessionId={}",
                            bookingId, session.getId());
                } else {
                    bookingService.confirmPaidBookingFromWebhook(b, customerEmail);
                }
            }

            b = bookingService.findBookingById(bookingId);
            log.info("AFTER confirm (fresh): bookingId={} status={} paidAt={}",
                    b.getBookingId(), b.getBookingStatus(), b.getPaidAt());

            emailOutboxService.enqueueBookingConfirmed(b);

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

    private void handleCheckoutExpired(Event event) {
        Session session = deserializeSession(event);
        if (session == null) {
            log.warn("checkout.session.expired: impossibile deserializzare Session. eventId={}", event.getId());
            return;
        }

        Map<String, String> metadata = session.getMetadata();
        String orderIdStr = metadata != null ? metadata.get("orderId") : null;
        String bookingIdStr = metadata != null ? metadata.get("bookingId") : null;

        if (orderIdStr != null) {
            UUID orderId = UUID.fromString(orderIdStr);
            boolean canceled = orderService.cancelIfPending(orderId, "STRIPE_SESSION_EXPIRED");
            if (canceled) {
                log.info("Webhook expired session -> canceled order {}", orderId);
            } else {
                log.info("checkout.session.expired: ordine {} non più PENDING_PAYMENT, skip", orderId);
            }
        }

        if (bookingIdStr != null) {
            UUID bookingId = UUID.fromString(bookingIdStr);
            Booking b = bookingService.findBookingById(bookingId);

            if (b.getBookingStatus() == BookingStatus.PENDING_PAYMENT) {
                b.setBookingStatus(BookingStatus.CANCELLED);
                b.setCanceledAt(LocalDateTime.now());
                b.setCancelReason("STRIPE_SESSION_EXPIRED");
                b.setExpiresAt(null);
                bookingService.save(b);
                log.info("Webhook expired session -> canceled booking {}", bookingId);
            } else {
                log.info("checkout.session.expired: booking {} già in stato {}, skip", bookingId, b.getBookingStatus());
            }
        }

        if (orderIdStr == null && bookingIdStr == null) {
            log.warn("checkout.session.expired senza orderId/bookingId in metadata. sessionId={}", session.getId());
        }
    }

    private Session deserializeSession(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();

        StripeObject obj = deserializer.getObject().orElse(null);
        if (obj instanceof Session s) return s;

        String rawJson = deserializer.getRawJson();
        if (rawJson != null && !rawJson.isBlank()) {
            return ApiResource.GSON.fromJson(rawJson, Session.class);
        }
        return null;
    }

    private void handlePaymentFailed(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        PaymentIntent intent = (PaymentIntent) deserializer.getObject().orElse(null);

        if (intent == null) {
            log.warn("payment_intent.payment_failed senza PaymentIntent");
            return;
        }

        Map<String, String> metadata = intent.getMetadata();

        // ── ORDINE ──
        String orderIdStr = metadata != null ? metadata.get("orderId") : null;
        if (orderIdStr != null) {
            UUID orderId = UUID.fromString(orderIdStr);
            orderService.updateOrderStatus(orderId, OrderStatus.FAILED);
            log.warn("Pagamento fallito per ordine {}", orderId);
            return;
        }

        // ── BOOKING ──
        String bookingIdStr = metadata != null ? metadata.get("bookingId") : null;
        if (bookingIdStr != null) {
            UUID bookingId = UUID.fromString(bookingIdStr);
            try {
                Booking booking = bookingService.findBookingById(bookingId);
                if (booking.getBookingStatus() == BookingStatus.PENDING_PAYMENT) {
                    booking.setBookingStatus(BookingStatus.CANCELLED);
                    booking.setCanceledAt(LocalDateTime.now());
                    booking.setCancelReason("PAYMENT_FAILED");
                    booking.setExpiresAt(null);
                    bookingService.save(booking);
                    log.warn("Pagamento fallito → booking {} cancellato (PAYMENT_FAILED)",
                            bookingId);
                } else {
                    log.info("payment_intent.payment_failed: booking {} già in stato {}, skip",
                            bookingId, booking.getBookingStatus());
                }
            } catch (Exception e) {
                log.error("Errore gestione payment_failed per booking {}: {}",
                        bookingId, e.getMessage());
            }
            return;
        }

        log.info("payment_intent.payment_failed: nessun orderId/bookingId nei metadata, skip");
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
            log.info("charge.refunded");
            return;
        }

        UUID orderId = UUID.fromString(orderIdStr);
        orderService.updateOrderStatus(orderId, OrderStatus.REFUNDED);
        log.info("Rimborso completato per ordine {}", orderId);
    }
}