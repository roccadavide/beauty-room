package daviderocca.beautyroom.controllers;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import daviderocca.beautyroom.DTO.orderDTOs.NewOrderDTO;
import daviderocca.beautyroom.DTO.orderDTOs.OrderResponseDTO;
import daviderocca.beautyroom.DTO.orderDTOs.OrderSummaryDTO;
import daviderocca.beautyroom.DTO.orderItemDTOs.OrderItemResponseDTO;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.UnauthorizedException;
import daviderocca.beautyroom.services.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;

import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/checkout")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    @Value("${stripe.secret}")
    private String stripeSecretKey;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    private final OrderService orderService;

    // FIX-24: Stripe.apiKey impostato una sola volta a startup invece che per ogni chiamata
    @PostConstruct
    public void init() {
        Stripe.apiKey = this.stripeSecretKey;
    }

    // ========== AUTHENTICATED ==========
    @PostMapping("/create-session")
    public Map<String, Object> createCheckoutSession(
            @Valid @RequestBody NewOrderDTO orderDTO,
            @AuthenticationPrincipal User currentUser
    ) throws StripeException {

        if (currentUser == null) throw new UnauthorizedException("Utente non autenticato.");

        NewOrderDTO dtoForUser = new NewOrderDTO(
                currentUser.getName(),
                currentUser.getSurname(),
                currentUser.getEmail(),
                currentUser.getPhone(),
                orderDTO.pickupNote(),
                orderDTO.items()
        );

        OrderResponseDTO pendingOrder = orderService.saveOrder(dtoForUser, currentUser);
        log.info("Creato ordine PENDING_PAYMENT (auth) ID: {}", pendingOrder.orderId());

        SessionCreateParams.Builder paramsBuilder = buildStripeParams(pendingOrder);
        Session session = Session.create(paramsBuilder.build());

        orderService.attachStripeSession(pendingOrder.orderId(), session.getId());

        Map<String, Object> response = new HashMap<>();
        response.put("url", session.getUrl());
        response.put("orderId", pendingOrder.orderId());
        return response;
    }

    // ========== GUEST (PUBLIC) ==========
    @PostMapping("/create-session-guest")
    public Map<String, Object> createCheckoutSessionGuest(@Valid @RequestBody NewOrderDTO orderDTO) throws StripeException {
        if (isBlank(orderDTO.customerName())
                || isBlank(orderDTO.customerSurname())
                || isBlank(orderDTO.customerEmail())
                || isBlank(orderDTO.customerPhone())) {
            throw new BadRequestException("Dati cliente mancanti per checkout guest.");
        }
        if (orderDTO.items() == null || orderDTO.items().isEmpty()) {
            throw new BadRequestException("L'ordine deve contenere almeno un prodotto.");
        }

        OrderResponseDTO pendingOrder = orderService.saveOrder(orderDTO, null);
        log.info("Creato ordine PENDING_PAYMENT (guest) ID: {}", pendingOrder.orderId());

        SessionCreateParams.Builder paramsBuilder = buildStripeParams(pendingOrder);
        Session session = Session.create(paramsBuilder.build());

        orderService.attachStripeSession(pendingOrder.orderId(), session.getId());

        Map<String, Object> response = new HashMap<>();
        response.put("url", session.getUrl());
        response.put("orderId", pendingOrder.orderId());
        return response;
    }

    @GetMapping("/order-summary")
    public ResponseEntity<OrderSummaryDTO> getOrderSummary(
            @RequestParam("session_id") String sessionId,
            @AuthenticationPrincipal User currentUser
    ) throws StripeException {
        Session session = Session.retrieve(sessionId);

        boolean isPaid = "paid".equalsIgnoreCase(session.getPaymentStatus());
        String orderIdStr = session.getMetadata() != null ? session.getMetadata().get("orderId") : null;

        if (orderIdStr == null) {
            return ResponseEntity.status(400).body(OrderSummaryDTO.error("orderId assente nei metadata della sessione"));
        }

        UUID orderId = UUID.fromString(orderIdStr);
        OrderResponseDTO order = orderService.findOrderByIdAndConvert(orderId);

        // Verifica owner solo per utenti autenticati
        // Gli ospiti (guest) accedono liberamente per opacità del session_id
        if (currentUser != null
                && order.userId() != null
                && !order.userId().equals(currentUser.getUserId())) {
            return ResponseEntity.status(403).build();
        }

        OrderSummaryDTO dto = OrderSummaryDTO.from(
                order,
                isPaid ? "PAID" : "PENDING",
                session.getCustomerDetails() != null ? session.getCustomerDetails().getEmail() : order.customerEmail()
        );

        return ResponseEntity.ok(dto);
    }

    // ===== helpers =====
    private SessionCreateParams.Builder buildStripeParams(OrderResponseDTO pendingOrder) {
        String orderId = pendingOrder.orderId().toString();

        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontendUrl + "/ordine-confermato?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(frontendUrl + "/carrello")
                .putMetadata("orderId", orderId)
                .setPaymentIntentData(
                        SessionCreateParams.PaymentIntentData.builder()
                                .putMetadata("orderId", orderId)
                                .build()
                );

        for (OrderItemResponseDTO item : pendingOrder.orderItems()) {
            builder.addLineItem(
                    SessionCreateParams.LineItem.builder()
                            .setQuantity((long) item.quantity())
                            .setPriceData(
                                    SessionCreateParams.LineItem.PriceData.builder()
                                            .setCurrency("eur")
                                            .setUnitAmount(item.price().setScale(2, RoundingMode.HALF_UP)
                                                                       .movePointRight(2)
                                                                       .longValueExact())
                                            .setProductData(
                                                    SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                            .setName("Prodotto")
                                                            .build()
                                            )
                                            .build()
                            )
                            .build()
            );
        }

        return builder;
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}