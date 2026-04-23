package daviderocca.beautyroom.controllers;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import daviderocca.beautyroom.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.BookingSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.beautyroom.entities.Promotion;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.repositories.PromotionRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import daviderocca.beautyroom.services.BookingService;
import daviderocca.beautyroom.services.ServiceItemService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/checkout/bookings")
@RequiredArgsConstructor
@Slf4j
public class BookingCheckoutController {

    @Value("${stripe.secret}")
    private String stripeSecretKey;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Value("${booking.hold.expire-minutes:12}")
    private int holdExpireMinutes;

    private final BookingService bookingService;
    private final ServiceItemService serviceItemService;
    private final ServiceOptionRepository serviceOptionRepository;
    private final PromotionRepository promotionRepository;
    private final ProductRepository productRepository;

    @PostConstruct
    public void init() {
        Stripe.apiKey = this.stripeSecretKey;
    }

    @PostMapping("/create-session")
    public Map<String, Object> createSessionAuth(
            @Valid @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) throws StripeException {

        if (currentUser == null) throw new BadRequestException("Utente non autenticato.");

        // Il flow Stripe non usa packageCreditId/paddingMinutes, ma propaga i consensi.
        NewBookingDTO dto = new NewBookingDTO(
                payload.customerName(),
                currentUser.getEmail(),
                payload.customerPhone(),
                payload.startTime(),
                payload.notes(),
                payload.serviceId(),
                payload.serviceOptionId(),
                null,                   // packageCreditId non applicabile nel flow Stripe
                payload.consentLaser(), // consenso informato laser
                payload.consentPmu(),   // consenso informato PMU
                payload.promoPrice(),   // propaga prezzo promo
                payload.promotionId(),  // propaga id promo
                null                    // paddingMinutes: non applicabile nel flow Stripe
        );

        return createStripeSessionForBooking(dto, currentUser);
    }

    // PUBLIC (guest)
    @PostMapping("/create-session-guest")
    public Map<String, Object> createSessionGuest(@Valid @RequestBody NewBookingDTO payload) throws StripeException {
        return createStripeSessionForBooking(payload, null);
    }

    private Map<String, Object> createStripeSessionForBooking(NewBookingDTO payload, User currentUserOrNull) throws StripeException {

        // 1) crea HOLD booking (blocca slot per N minuti)
        BookingResponseDTO hold = bookingService.createHoldBooking(payload, currentUserOrNull);

        // 2) calcola prezzo: option.price se presente, altrimenti service.price
        ServiceItem service = serviceItemService.findServiceItemById(payload.serviceId());
        serviceItemService.assertServiceActive(service);
        ServiceOption option = null;
        if (payload.serviceOptionId() != null) {
            option = serviceOptionRepository.findById(payload.serviceOptionId())
                    .orElseThrow(() -> new BadRequestException("Opzione non trovata."));
        }

        BigDecimal amount;
        if (payload.promoPrice() != null && payload.promotionId() != null) {

            Promotion promo = promotionRepository.findByIdWithDetails(payload.promotionId())
                    .orElseThrow(() -> new BadRequestException("Promozione non trovata."));

            if (!promo.isCurrentlyActive()) {
                throw new BadRequestException("Promozione non più attiva.");
            }

            BigDecimal serverPrice = computeServerPromoPrice(promo, service, option);
            if (serverPrice == null || serverPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BadRequestException("Promozione non applicabile a questo servizio.");
            }

            BigDecimal minimumAcceptable = serverPrice.multiply(
                    BigDecimal.valueOf(0.99)).setScale(2, RoundingMode.HALF_UP);
            if (payload.promoPrice().compareTo(minimumAcceptable) < 0) {
                log.warn("promoPrice manomesso: atteso >= {} ricevuto {} per promotionId={}",
                        minimumAcceptable, payload.promoPrice(), payload.promotionId());
                throw new BadRequestException("Prezzo promozionale non valido.");
            }

            amount = serverPrice;

        } else if (payload.promoPrice() != null && payload.promotionId() == null) {
            throw new BadRequestException("promotionId obbligatorio se promoPrice è presente.");
        } else {
            amount = (option != null ? option.getPrice() : service.getPrice());
        }
        if (amount == null || amount.signum() <= 0) throw new BadRequestException("Prezzo non valido.");

        int sessionsTotal = (option != null && option.getSessions() != null ? option.getSessions() : 1);

        // 3) crea session Stripe
        String bookingId = hold.bookingId().toString();

        long sessionDurationSeconds = Math.max(
                (holdExpireMinutes + 3) * 60L,
                30 * 60L
        );
        long expiresAt = Instant.now().plusSeconds(sessionDurationSeconds).getEpochSecond();

        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setExpiresAt(expiresAt)
                .setSuccessUrl(frontendUrl + "/prenotazione-confermata?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(
                        payload.promotionId() != null
                                ? frontendUrl + "/occasioni?cancel=1&tab=promozioni&promo=" + payload.promotionId()
                                : frontendUrl + "/trattamenti/" + service.getServiceId() + "?cancel=1"
                )
                .putMetadata("bookingId", bookingId)
                .putMetadata("serviceId", service.getServiceId().toString())
                .putMetadata("sessionsTotal", String.valueOf(sessionsTotal))
                .setCustomerEmail(payload.customerEmail());

        if (payload.promotionId() != null) {
            builder.putMetadata("promotionId", payload.promotionId().toString());
        }

        builder.setPaymentIntentData(
                SessionCreateParams.PaymentIntentData.builder()
                        .putMetadata("bookingId", bookingId)
                        .putMetadata("serviceId", service.getServiceId().toString())
                        .putMetadata("sessionsTotal", String.valueOf(sessionsTotal))
                        .build()
        );

        builder.addLineItem(
                SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(
                                SessionCreateParams.LineItem.PriceData.builder()
                                        .setCurrency("eur")
                                        .setUnitAmount(amount.movePointRight(2).longValueExact())
                                        .setProductData(
                                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                        .setName(service.getTitle()
                                                                + (option != null ? " — " + option.getName() : "")
                                                                + (payload.promoPrice() != null ? " (Promozione)" : ""))
                                                        .build()
                                        )
                                        .build()
                        )
                        .build()
        );

        Session session = Session.create(builder.build());

        // 4) salva stripe session id sul booking
        bookingService.attachStripeSession(hold.bookingId(), session.getId());

        Map<String, Object> resp = new HashMap<>();
        resp.put("url", session.getUrl());
        resp.put("bookingId", hold.bookingId());
        return resp;
    }

    /**
     * Prenotazione con pagamento in loco (PAY_IN_STORE).
     * Solo per clienti di fiducia (isVerified = true).
     * Crea una prenotazione CONFIRMED senza sessione Stripe.
     */
    @PostMapping("/create-pay-in-store")
    public ResponseEntity<BookingResponseDTO> createPayInStoreBooking(
            @Valid @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) throw new BadRequestException("Utente non autenticato.");
        BookingResponseDTO booking = bookingService.createPayInStoreBooking(payload, currentUser);
        return ResponseEntity.status(201).body(booking);
    }

    @GetMapping("/booking-summary")
    public ResponseEntity<BookingSummaryDTO> getBookingSummary(
            @RequestParam("session_id") String sessionId,
            @AuthenticationPrincipal User currentUser
    ) throws StripeException {
        Session session = Session.retrieve(sessionId);

        boolean isPaid = "paid".equalsIgnoreCase(session.getPaymentStatus());
        String bookingIdStr = session.getMetadata() != null ? session.getMetadata().get("bookingId") : null;

        if (bookingIdStr == null) {
            return ResponseEntity.status(400).body(BookingSummaryDTO.error("bookingId assente nei metadata della sessione"));
        }

        UUID bookingId = UUID.fromString(bookingIdStr);
        BookingResponseDTO booking = bookingService.findBookingByIdAndConvert(bookingId);

        if (currentUser != null && booking.userId() != null
                && !booking.userId().equals(currentUser.getUserId())) {
            return ResponseEntity.status(403).build();
        }

        String email = session.getCustomerDetails() != null
                ? session.getCustomerDetails().getEmail()
                : booking.customerEmail();

        BookingSummaryDTO dto = new BookingSummaryDTO(
                booking,
                isPaid ? "PAID" : "PENDING",
                email
        );

        return ResponseEntity.ok(dto);
    }

    private BigDecimal computeServerPromoPrice(
            Promotion promo,
            ServiceItem service,
            ServiceOption option) {

        BigDecimal servicePrice = option != null ? option.getPrice() : service.getPrice();
        if (servicePrice == null) return null;

        BigDecimal serviceTotal = promo.getServices().stream()
                .filter(s -> s.getServiceId().equals(service.getServiceId()))
                .findFirst()
                .map(s -> option != null ? option.getPrice() : s.getPrice())
                .orElse(servicePrice);

        BigDecimal productTotal = promo.getProducts().stream()
                .map(p -> p.getPrice() != null ? p.getPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal grandTotal = serviceTotal.add(productTotal);
        if (grandTotal.compareTo(BigDecimal.ZERO) <= 0) return null;

        BigDecimal discounted;
        switch (promo.getDiscountType()) {
            case PERCENTAGE -> discounted = grandTotal.subtract(
                    grandTotal.multiply(promo.getDiscountValue())
                              .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
            case FIXED -> discounted = grandTotal.subtract(promo.getDiscountValue())
                    .max(BigDecimal.ZERO);
            case PRICE_OVERRIDE -> discounted = promo.getDiscountValue();
            default -> { return null; }
        }

        return discounted.setScale(2, RoundingMode.HALF_UP);
    }
}