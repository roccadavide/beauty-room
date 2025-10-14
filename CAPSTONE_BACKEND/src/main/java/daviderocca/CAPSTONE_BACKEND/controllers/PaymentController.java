package daviderocca.CAPSTONE_BACKEND.controllers;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs.NewOrderDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderItemDTOs.NewOrderItemDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs.OrderResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderItemDTOs.OrderItemResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.services.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/checkout")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    @Value("${stripe.secret}")
    private String stripeSecretKey;

    private final OrderService orderService;

    @PostMapping("/create-session")
    public Map<String, Object> createCheckoutSession(@RequestBody NewOrderDTO orderDTO,
                                                     Authentication authentication) throws StripeException {

        Stripe.apiKey = stripeSecretKey;

        User currentUser = authentication != null ? (User) authentication.getPrincipal() : null;

        // Crea ordine PENDING nel DB
        OrderResponseDTO pendingOrder = orderService.saveOrder(orderDTO, currentUser);
        log.info("Creato ordine PENDING con ID: {}", pendingOrder.orderId());

        // Calcola totale (in centesimi)
        long totalAmount = pendingOrder.orderItems().stream()
                .map(item -> item.price().multiply(BigDecimal.valueOf(item.quantity())))
                .mapToLong(BigDecimal::longValue)
                .sum();

        // 3️⃣ Crea la sessione Stripe
        SessionCreateParams.Builder paramsBuilder = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl("http://localhost:5173/ordine-confermato/" + pendingOrder.orderId())
                .setCancelUrl("http://localhost:5173/carrello")
                .putMetadata("orderId", pendingOrder.orderId().toString());

        // Aggiunge ogni prodotto alla sessione
        for (OrderItemResponseDTO item : pendingOrder.orderItems()) {
            paramsBuilder.addLineItem(
                    SessionCreateParams.LineItem.builder()
                            .setQuantity((long) item.quantity())
                            .setPriceData(
                                    SessionCreateParams.LineItem.PriceData.builder()
                                            .setCurrency("eur")
                                            .setUnitAmount((long) (item.price().doubleValue() * 100))
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

        Session session = Session.create(paramsBuilder.build());
        log.info("Creata sessione Stripe per ordine {}", pendingOrder.orderId());

        Map<String, Object> response = new HashMap<>();
        response.put("url", session.getUrl());
        response.put("orderId", pendingOrder.orderId());
        return response;
    }
}