package daviderocca.beautyroom.controllers;

import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.*;
import com.stripe.model.Refund;
import com.stripe.param.RefundCreateParams;
import com.stripe.model.checkout.Session;
import com.stripe.net.ApiResource;
import com.stripe.net.Webhook;
import daviderocca.beautyroom.DTO.bookingDTOs.SaleEntryDTO;
import daviderocca.beautyroom.email.outbox.EmailOutboxService;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Order;
import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.entities.ProcessedStripeEvent;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ProcessedStripeEventRepository;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.OrderStatus;
import daviderocca.beautyroom.services.BookingService;
import daviderocca.beautyroom.services.OrderService;
import daviderocca.beautyroom.services.PackageCreditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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

        // ===== MULTI-SERVICE BOOKING =====
        String bookingType = metadata != null ? metadata.get("bookingType") : null;
        if ("MULTI".equals(bookingType)) {
            handleMultiServiceBooking(session, metadata, customerEmail);
            return;
        }

        // ===== PRODUCT PROMO (session-only checkout) =====
        String promoType = metadata != null ? metadata.get("promoType") : null;
        if ("PRODUCT".equals(promoType)) {
            fulfillProductPromoOrder(session, metadata, customerEmail);
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
                            b.setCancelReason("PAID_CONFLICT_REFUND_FAILED");
                            bookingRepository.save(b);
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

    private void handleMultiServiceBooking(Session session, Map<String, String> metadata, String customerEmail) {
        // 08.4: per-session idempotency — if a booking already exists for this Stripe session, skip
        // (prevents a duplicate booking → duplicate stock decrement, beyond the per-event guard).
        if (bookingRepository.findByStripeSessionId(session.getId()).isPresent()) {
            log.info("MULTI booking already exists for sessionId={}, skip", session.getId());
            return;
        }

        // 08.4: when present, this is a PROMO booking — services come from the promo, not serviceIds.
        String promotionIdStr = metadata.getOrDefault("promotionId", null);
        UUID promotionId = null;
        if (promotionIdStr != null && !promotionIdStr.isBlank()) {
            try {
                promotionId = UUID.fromString(promotionIdStr);
            } catch (Exception e) {
                log.error("MULTI booking: promotionId non valido '{}'", promotionIdStr);
                return;
            }
        }

        String serviceIdsRaw      = metadata.getOrDefault("serviceIds", "");
        String dateStr            = metadata.getOrDefault("date", "");
        String startTimeStr       = metadata.getOrDefault("startTime", "");
        String durationStr        = metadata.getOrDefault("totalDurationMinutes", "0");
        String customerName       = metadata.getOrDefault("customerName", "");
        String customerPhone      = metadata.getOrDefault("customerPhone", "");
        String notes              = metadata.getOrDefault("notes", null);

        // Fix 9: laser/PMU consent acknowledgment from the cart flow. Absent keys → false (promo MULTI
        // sessions carry no consent keys and simply get false).
        boolean consentLaser = "true".equals(metadata.getOrDefault("consentLaser", "false"));
        boolean consentPmu   = "true".equals(metadata.getOrDefault("consentPmu", "false"));

        // Fix 3 (mixed cart): optional products bought alongside the services. Robust parse — the
        // customer already paid, so a malformed/missing entry is skipped (logged), never thrown.
        // Promo sessions carry no "products" key, so this is naturally empty for them.
        List<SaleEntryDTO> productSales = parseProductsMetadata(metadata.getOrDefault("products", ""));

        // PROMO booking carries no serviceIds (services live in the promo snapshot) — require them
        // only for the non-promo path; date/startTime are required for both.
        if ((promotionId == null && serviceIdsRaw.isBlank()) || dateStr.isBlank() || startTimeStr.isBlank()) {
            log.error("MULTI booking: metadata incompleta — promotionId={} serviceIds={} date={} startTime={}",
                    promotionId, serviceIdsRaw, dateStr, startTimeStr);
            return;
        }

        List<UUID> serviceIds;
        if (promotionId != null) {
            serviceIds = List.of(); // promo booking: services come from the promo snapshot
        } else {
            try {
                serviceIds = Arrays.stream(serviceIdsRaw.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(UUID::fromString)
                        .collect(Collectors.toList());
            } catch (Exception e) {
                log.error("MULTI booking: impossibile parsare serviceIds='{}': {}", serviceIdsRaw, e.getMessage());
                return;
            }
        }

        LocalDate date;
        LocalTime startTime;
        int totalDurationMinutes;
        try {
            date = LocalDate.parse(dateStr);
            startTime = LocalTime.parse(startTimeStr);
            totalDurationMinutes = Integer.parseInt(durationStr);
        } catch (Exception e) {
            log.error("MULTI booking: impossibile parsare data/ora/durata: {}", e.getMessage());
            return;
        }

        // Fix 11: option-aware services subtotal (cents) — present only when the cart used a service
        // option. Recorded as the appointment's customTotalPrice so the agenda shows the right total.
        BigDecimal customTotalPrice = null;
        String servicesTotalCentsRaw = metadata.getOrDefault("servicesTotalCents", "");
        if (!servicesTotalCentsRaw.isBlank()) {
            try {
                customTotalPrice = new BigDecimal(servicesTotalCentsRaw.trim()).movePointLeft(2);
            } catch (Exception e) {
                log.warn("MULTI booking: servicesTotalCents non parsabile '{}': {}",
                        servicesTotalCentsRaw, e.getMessage());
            }
        }

        daviderocca.beautyroom.entities.Booking saved;
        try {
            saved = bookingService.createMultiServiceBookingFromWebhook(
                    serviceIds, date, startTime, totalDurationMinutes,
                    customerName, customerEmail, customerPhone, notes, session.getId(), promotionId, productSales,
                    consentLaser, consentPmu, customTotalPrice
            );
        } catch (daviderocca.beautyroom.exceptions.BadRequestException bex) {
            if ("CONFLICT".equals(bex.getMessage())) {
                log.error("MULTI PAID_CONFLICT: slot già occupato, sessionId={} — avvio rimborso automatico.", session.getId());
                try {
                    Stripe.apiKey = stripeSecretKey;
                    String paymentIntentId = session.getPaymentIntent();
                    if (paymentIntentId != null && !paymentIntentId.isBlank()) {
                        RefundCreateParams refundParams = RefundCreateParams.builder()
                                .setPaymentIntent(paymentIntentId)
                                .build();
                        Refund.create(refundParams);
                        log.info("MULTI PAID_CONFLICT: rimborso Stripe creato per sessionId={}", session.getId());
                    } else {
                        log.error("MULTI PAID_CONFLICT: payment_intent assente — rimborso manuale necessario. sessionId={}", session.getId());
                    }
                } catch (StripeException ex) {
                    log.error("MULTI PAID_CONFLICT: errore rimborso Stripe sessionId={}: {}", session.getId(), ex.getMessage());
                }
            } else {
                log.error("MULTI booking: errore creazione per sessionId={}: {}", session.getId(), bex.getMessage());
            }
            return;
        } catch (Exception e) {
            log.error("MULTI booking: errore inatteso per sessionId={}: {}", session.getId(), e.getMessage(), e);
            return;
        }

        try {
            emailOutboxService.enqueueBookingConfirmed(saved);
        } catch (Exception e) {
            log.error("MULTI booking: errore invio email confermata bookingId={}: {}", saved.getBookingId(), e.getMessage());
        }

        log.info("MULTI booking confermato: bookingId={} sessionId={} servizi={} cliente={}",
                saved.getBookingId(), session.getId(), serviceIds.size(), customerEmail);
    }

    /**
     * Fix 3: parses the "products" metadata ({@code "<productId>:<qty>:<unitAmountCents>,..."}) into
     * sale carriers (paid = true). Robust by design — the customer has already paid, so a malformed
     * entry is skipped (logged), never thrown; a missing/blank input yields an empty list. The
     * unitPrice is reconstructed from the cents that were ACTUALLY charged at session creation, so it
     * never re-resolves against a possibly-changed catalog price. Package-private for unit testing.
     */
    static List<SaleEntryDTO> parseProductsMetadata(String raw) {
        List<SaleEntryDTO> out = new ArrayList<>();
        if (raw == null || raw.isBlank()) return out;
        for (String token : raw.split(",")) {
            String t = token.trim();
            if (t.isEmpty()) continue;
            String[] parts = t.split(":");
            if (parts.length != 3) {
                log.warn("MULTI booking: voce prodotto malformata, skip: '{}'", t);
                continue;
            }
            try {
                UUID productId = UUID.fromString(parts[0].trim());
                int quantity = Math.max(1, Integer.parseInt(parts[1].trim()));
                long cents = Long.parseLong(parts[2].trim());
                BigDecimal unitPrice = BigDecimal.valueOf(cents).movePointLeft(2);
                out.add(new SaleEntryDTO(productId, quantity, unitPrice, true));
            } catch (Exception e) {
                log.warn("MULTI booking: voce prodotto non parsabile, skip: '{}' ({})", t, e.getMessage());
            }
        }
        return out;
    }

    // Fulfillment promo SOLO prodotti (checkout session-only del prompt 05): crea l'ordine
    // pagato + scarica lo stock + invia l'email. Idempotente per sessione Stripe (in più
    // dell'idempotenza per event-id già garantita da ProcessedStripeEvent).
    private void fulfillProductPromoOrder(Session session, Map<String, String> metadata, String customerEmail) {
        String promotionIdStr = metadata != null ? metadata.get("promotionId") : null;
        if (promotionIdStr == null || promotionIdStr.isBlank()) {
            log.error("promo PRODUCT: promotionId assente nei metadata. sessionId={}", session.getId());
            return;
        }
        UUID promotionId;
        try {
            promotionId = UUID.fromString(promotionIdStr);
        } catch (Exception e) {
            log.error("promo PRODUCT: promotionId non valido '{}': {}", promotionIdStr, e.getMessage());
            return;
        }

        UUID userId = null;
        String userIdStr = metadata.get("userId");
        if (userIdStr != null && !userIdStr.isBlank()) {
            try { userId = UUID.fromString(userIdStr); } catch (Exception ignored) { /* guest */ }
        }

        String customerName  = session.getCustomerDetails() != null ? session.getCustomerDetails().getName() : null;
        String customerPhone = session.getCustomerDetails() != null ? session.getCustomerDetails().getPhone() : null;

        try {
            Order order = orderService.fulfillProductPromoOrder(
                    promotionId, userId, customerName, customerEmail, customerPhone,
                    session.getId(), session.getAmountTotal());
            if (order != null) {
                log.info("Promo PRODUCT fulfilled: orderId={} sessionId={} cliente={}",
                        order.getOrderId(), session.getId(), customerEmail);
            }
        } catch (Exception e) {
            log.error("Promo PRODUCT fulfillment errore sessionId={}: {}", session.getId(), e.getMessage(), e);
        }
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