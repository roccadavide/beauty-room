package daviderocca.CAPSTONE_BACKEND.controllers;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/checkout")
public class PaymentController {

    @Value("${stripe.secret}")
    private String stripeSecretKey;

    @PostMapping
    public Map<String, Object> createCheckoutSession(@RequestBody Map<String, Object> payload) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        String productName = (String) payload.get("productName");
        double amount = Double.parseDouble(payload.get("amount").toString());
        int quantity = (int) payload.getOrDefault("quantity", 1);

        SessionCreateParams params = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl("http://localhost:5173/ordine-confermato")
                .setCancelUrl("http://localhost:5173/carrello")
                .addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setQuantity((long) quantity)
                                .setPriceData(
                                        SessionCreateParams.LineItem.PriceData.builder()
                                                .setCurrency("eur")
                                                .setUnitAmount((long) (amount * 100))
                                                .setProductData(
                                                        SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                .setName(productName)
                                                                .build()
                                                )
                                                .build()
                                )
                                .build()
                )
                .build();

        Session session = Session.create(params);

        Map<String, Object> response = new HashMap<>();
        response.put("url", session.getUrl());
        return response;
    }
}