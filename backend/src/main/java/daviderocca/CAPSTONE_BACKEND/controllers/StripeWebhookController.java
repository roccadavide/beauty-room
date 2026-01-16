package daviderocca.CAPSTONE_BACKEND.controllers;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Charge;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.PaymentIntent;
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
            log.error("Errore gestione Stripe {}: {}", event.getType(), e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error processing event");
        }

        return ResponseEntity.ok("success");
    }

    private void handleCheckoutCompleted(Event event) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        Session session = (Session) deserializer.getObject().orElse(null);

        if (session == null) {
            log.warn("checkout.session.completed senza Session");
            return;
        }

        Map<String, String> metadata = session.getMetadata();
        String orderIdStr = metadata != null ? metadata.get("orderId") : null;

        if (orderIdStr == null) {
            log.warn("checkout.session.completed senza orderId in metadata");
            return;
        }

        UUID orderId = UUID.fromString(orderIdStr);
        String customerEmail = session.getCustomerDetails() != null
                ? session.getCustomerDetails().getEmail()
                : "unknown";

        orderService.markOrderAsPaid(orderId, customerEmail);
        log.info("Pagamento completato per ordine {} (cliente: {})", orderId, customerEmail);
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
            log.warn("payment_intent.payment_failed senza orderId in metadata");
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
            log.warn("charge.refunded senza orderId in metadata");
            return;
        }

        UUID orderId = UUID.fromString(orderIdStr);
        orderService.updateOrderStatus(orderId, OrderStatus.REFUNDED);
        log.info("Rimborso completato per ordine {}", orderId);
    }
}