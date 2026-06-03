package daviderocca.beautyroom.controllers;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import daviderocca.beautyroom.DTO.promotionDTOs.NewPromotionDTO;
import daviderocca.beautyroom.DTO.promotionDTOs.ProductPromoCheckoutInfo;
import daviderocca.beautyroom.DTO.promotionDTOs.PromotionResponseDTO;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.PromotionScope;
import daviderocca.beautyroom.services.PromotionService;
import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/promotions")
@RequiredArgsConstructor
@Slf4j
public class PromotionController {

    private final PromotionService promotionService;

    @Value("${stripe.secret}")
    private String stripeSecretKey;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @PostConstruct
    public void init() {
        Stripe.apiKey = this.stripeSecretKey;
    }

    // ---------------------------------- GET ----------------------------------
    @GetMapping("/active")
    public ResponseEntity<List<PromotionResponseDTO>> getActivePromotions() {
        log.info("Richiesta elenco promozioni attive");
        List<PromotionResponseDTO> activePromos = promotionService.findActivePromotions();
        return ResponseEntity.ok(activePromos);
    }

    @GetMapping
    public ResponseEntity<Page<PromotionResponseDTO>> getAllPromotions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "priority") String sort,
            @RequestParam(defaultValue = "false") boolean includeInactive,
            Authentication authentication
    ) {
        boolean isAdmin = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        log.info("Richiesta elenco promozioni [page={}, size={}, sort={}, includeInactive={}]", page, size, sort, isAdmin && includeInactive);
        Page<PromotionResponseDTO> promotions = promotionService.findAllPromotions(page, size, sort, isAdmin && includeInactive);
        return ResponseEntity.ok(promotions);
    }

    @GetMapping("/scope/{scope}")
    public ResponseEntity<List<PromotionResponseDTO>> getPromotionsByScope(@PathVariable PromotionScope scope) {
        log.info("Richiesta promozioni per scope: {}", scope);
        List<PromotionResponseDTO> results = promotionService.findByScope(scope);
        return ResponseEntity.ok(results);
    }

    @GetMapping("/{promotionId}")
    public ResponseEntity<PromotionResponseDTO> getPromotionById(@PathVariable UUID promotionId) {
        log.info("Richiesta dettaglio promozione {}", promotionId);
        return ResponseEntity.ok(promotionService.findByIdAndConvert(promotionId));
    }

    // ------------------------- PRODUCT-PROMO CHECKOUT (public) -------------------------
    // Promo SOLO prodotti → Stripe Checkout per il bundle al prezzo promo arrotondato.
    // Le promo con trattamento passano dalla prenotazione (rifiutate qui con 400).
    // L'importo è calcolato server-side; nessun valore dal client è considerato attendibile.
    @PostMapping("/{promotionId}/checkout")
    public ResponseEntity<Map<String, Object>> createProductPromoCheckout(
            @PathVariable UUID promotionId,
            @AuthenticationPrincipal User currentUser
    ) throws StripeException {
        ProductPromoCheckoutInfo info = promotionService.prepareProductPromoCheckout(promotionId);
        log.info("Checkout promo prodotti {} importo={}", info.promotionId(), info.amount());

        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontendUrl + "/ordine-confermato?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(frontendUrl + "/occasioni?cancel=1&tab=promozioni&promo=" + info.promotionId())
                .putMetadata("promotionId", info.promotionId().toString())
                .putMetadata("promoType", "PRODUCT");

        if (currentUser != null) {
            if (currentUser.getEmail() != null) builder.setCustomerEmail(currentUser.getEmail());
            // Link the resulting order to the buyer at webhook fulfillment time.
            builder.putMetadata("userId", currentUser.getUserId().toString());
        }

        builder.addLineItem(
                SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(
                                SessionCreateParams.LineItem.PriceData.builder()
                                        .setCurrency("eur")
                                        .setUnitAmount(info.amount().movePointRight(2).longValueExact())
                                        .setProductData(
                                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                        .setName(info.title() + " (Promozione)")
                                                        .build()
                                        )
                                        .build()
                        )
                        .build()
        );

        Session session = Session.create(builder.build());

        Map<String, Object> resp = new HashMap<>();
        resp.put("url", session.getUrl());
        return ResponseEntity.ok(resp);
    }

    // ---------------------------------- POST ----------------------------------
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PromotionResponseDTO> createPromotion(
            @Valid @RequestPart("data") NewPromotionDTO payload,
            @RequestPart(value = "bannerImage", required = false) MultipartFile bannerImage,
            @RequestPart(value = "cardImage", required = false) MultipartFile cardImage
    ) {
        log.info("Creazione promozione '{}'", payload.title());
        PromotionResponseDTO created = promotionService.createPromotion(payload, bannerImage, cardImage);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT --------------------------------
    @PutMapping(value = "/{promotionId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PromotionResponseDTO> updatePromotion(
            @PathVariable UUID promotionId,
            @Valid @RequestPart("data") NewPromotionDTO payload,
            @RequestPart(value = "bannerImage", required = false) MultipartFile bannerImage,
            @RequestPart(value = "cardImage", required = false) MultipartFile cardImage
    ) {
        log.info("Aggiornamento promozione {}", promotionId);
        PromotionResponseDTO updated = promotionService.updatePromotion(promotionId, payload, bannerImage, cardImage);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- DELETE ----------------------------------
    @DeleteMapping("/{promotionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deletePromotion(@PathVariable UUID promotionId) {
        log.info("Eliminazione promozione {}", promotionId);
        promotionService.deletePromotion(promotionId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{promotionId}/toggle-active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> toggleActive(@PathVariable UUID promotionId) {
        promotionService.toggleActive(promotionId);
        return ResponseEntity.ok().build();
    }
}