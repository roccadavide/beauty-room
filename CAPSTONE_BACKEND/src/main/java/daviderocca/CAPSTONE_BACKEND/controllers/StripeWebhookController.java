package daviderocca.CAPSTONE_BACKEND.controllers;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import daviderocca.CAPSTONE_BACKEND.enums.OrderStatus;
import daviderocca.CAPSTONE_BACKEND.services.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping("/webhook")
    public ResponseEntity<String> handleStripeEvent(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {

        Event event;

        // 1. Verifica autenticità dell’evento ricevuto da Stripe
        try {
            event = Webhook.constructEvent(payload, sigHeader, endpointSecret);
        } catch (SignatureVerificationException e) {
            log.error("Verifica firma webhook fallita: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        }

        log.info("Ricevuto evento Stripe: {}", event.getType());

        try {
            switch (event.getType()) {

                // 2. Pagamento completato
                case "checkout.session.completed" -> handleCheckoutCompleted(event);

                // 3. Pagamento fallito
                case "payment_intent.payment_failed" -> handlePaymentFailed(event);

                // 4. Rimborso completato
                case "charge.refunded" -> handleRefund(event);

                // 5. Eventi non gestiti
                default -> log.info("Evento non gestito: {}", event.getType());
            }
        } catch (Exception e) {
            log.error("Errore nella gestione evento Stripe {}: {}", event.getType(), e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error processing event");
        }

        return ResponseEntity.ok("success");
    }

    // ----------------------------------------------------
    // HANDLE CHECKOUT SUCCESS
    // ----------------------------------------------------
    private void handleCheckoutCompleted(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        Session session = (Session) deserializer.getObject().orElse(null);

        if (session == null) {
            log.warn("Nessuna sessione trovata nell’evento checkout.session.completed");
            return;
        }

        Map<String, String> metadata = session.getMetadata();
        String orderIdStr = metadata != null ? metadata.get("orderId") : null;

        if (orderIdStr == null) {
            log.warn("Nessun orderId trovato nei metadata della sessione Stripe");
            return;
        }

        UUID orderId = UUID.fromString(orderIdStr);
        String customerEmail = session.getCustomerDetails() != null
                ? session.getCustomerDetails().getEmail()
                : "unknown";

        orderService.markOrderAsPaid(orderId, customerEmail);
        log.info("Pagamento completato per ordine {} (cliente: {})", orderId, customerEmail);
    }

    // ----------------------------------------------------
    // HANDLE PAYMENT FAILED
    // ----------------------------------------------------
    private void handlePaymentFailed(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        PaymentIntent intent = (PaymentIntent) deserializer.getObject().orElse(null);

        if (intent == null) {
            log.warn("Nessun PaymentIntent trovato per evento payment_intent.payment_failed");
            return;
        }

        String orderIdStr = intent.getMetadata() != null ? intent.getMetadata().get("orderId") : null;

        if (orderIdStr == null) {
            log.warn("Nessun orderId nei metadata del PaymentIntent fallito");
            return;
        }

        UUID orderId = UUID.fromString(orderIdStr);
        orderService.updateOrderStatus(orderId, OrderStatus.FAILED);
        log.warn("Pagamento fallito per ordine {}", orderId);
    }

    // ----------------------------------------------------
    // HANDLE REFUND
    // ----------------------------------------------------
    private void handleRefund(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        Refund refund = (Refund) deserializer.getObject().orElse(null);

        if (refund == null) {
            log.warn("Nessun Refund trovato per evento charge.refunded");
            return;
        }

        String orderIdStr = refund.getMetadata() != null ? refund.getMetadata().get("orderId") : null;

        if (orderIdStr == null) {
            log.warn("Nessun orderId trovato nei metadata del rimborso");
            return;
        }

        UUID orderId = UUID.fromString(orderIdStr);
        orderService.updateOrderStatus(orderId, OrderStatus.REFUNDED);
        log.info("Rimborso completato per ordine {}", orderId);
    }
}