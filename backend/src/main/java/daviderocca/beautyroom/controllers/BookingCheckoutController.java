package daviderocca.beautyroom.controllers;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import daviderocca.beautyroom.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.BookingSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.ProductEntryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PublicMultiServiceBookingDTO;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.entities.Product;
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
import daviderocca.beautyroom.util.PricingUtils;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final BookingRepository bookingRepository;

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
                null,                   // serviceIds: checkout uses single serviceId
                payload.serviceOptionId(),
                null,                   // packageCreditId non applicabile nel flow Stripe
                payload.consentLaser(), // consenso informato laser
                payload.consentPmu(),   // consenso informato PMU
                payload.promoPrice(),   // propaga prezzo promo
                payload.promotionId(),  // propaga id promo
                null,
                false                   // paidInStore: non applicabile nel flow Stripe
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
     * Multi-service public checkout. No pre-hold booking is created.
     * The booking is created by the webhook after payment succeeds.
     * Validates services, computes total price, creates Stripe session with MULTI metadata.
     */
    @PostMapping("/create-session-multi")
    public Map<String, Object> createSessionMulti(
            @Valid @RequestBody PublicMultiServiceBookingDTO payload
    ) throws StripeException {

        // 08.4: a promotion booking takes its services from the promo snapshot, not serviceIds —
        // route it through the dedicated promo session builder (same pricing source as the snapshot).
        if (payload.promotionId() != null) {
            return createPromoMultiSession(payload);
        }

        if (payload.serviceIds() == null || payload.serviceIds().isEmpty()) {
            throw new BadRequestException("Seleziona almeno un servizio.");
        }

        // Resolve and validate all services. Fix 11: price each line from the SELECTED OPTION
        // (option.getPrice()) when one was chosen, else the base service price. serviceOptionIds is
        // INDEX-ALIGNED to serviceIds (same FE .map()); a null/short entry means "no option".
        List<UUID> serviceIds = payload.serviceIds();
        List<UUID> serviceOptionIds = payload.serviceOptionIds();
        List<ServiceItem> services = new ArrayList<>();
        List<ServiceOption> lineOptions = new ArrayList<>(); // parallel to services; null = no option
        BigDecimal servicesTotal = BigDecimal.ZERO;
        boolean anyOption = false;
        for (int i = 0; i < serviceIds.size(); i++) {
            UUID sid = serviceIds.get(i);
            ServiceItem svc = serviceItemService.findServiceItemById(sid);
            serviceItemService.assertServiceActive(svc);

            UUID optId = (serviceOptionIds != null && i < serviceOptionIds.size())
                    ? serviceOptionIds.get(i) : null;
            ServiceOption option = null;
            if (optId != null) {
                // Validate-by-query so we never lazy-load the option's service (OSIV is off):
                // empty ⇒ option missing OR not owned by this service → reject with a clear 400.
                option = serviceOptionRepository.findByOptionIdAndService_ServiceId(optId, sid)
                        .orElseThrow(() -> new BadRequestException(
                                "L'opzione selezionata non appartiene al servizio '" + svc.getTitle() + "'."));
                anyOption = true;
            }

            BigDecimal unitPrice = (option != null) ? option.getPrice() : svc.getPrice();
            if (unitPrice == null || unitPrice.signum() <= 0) {
                throw new BadRequestException("Il servizio '" + svc.getTitle() + "' non ha un prezzo valido.");
            }
            services.add(svc);
            lineOptions.add(option);
            servicesTotal = servicesTotal.add(unitPrice);
        }

        servicesTotal = servicesTotal.setScale(2, RoundingMode.HALF_UP);

        // Build line items (one per service)
        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setExpiresAt(Instant.now().plusSeconds(30 * 60L).getEpochSecond())
                .setSuccessUrl(frontendUrl + "/prenotazione-confermata?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(frontendUrl + "/carrello?cancel=1")
                .setCustomerEmail(payload.customerEmail())
                .putMetadata("bookingType", "MULTI")
                .putMetadata("serviceIds", payload.serviceIds().stream()
                        .map(UUID::toString).reduce((a, b) -> a + "," + b).orElse(""))
                .putMetadata("date", payload.date().toString())
                .putMetadata("startTime", payload.startTime().toString())
                .putMetadata("totalDurationMinutes", String.valueOf(payload.totalDurationMinutes()))
                .putMetadata("customerName", payload.customerName())
                .putMetadata("customerPhone", payload.customerPhone() != null ? payload.customerPhone() : "")
                // Fix 9: laser/PMU consent acknowledgment (two booleans → trivial vs the 500-char cap).
                .putMetadata("consentLaser", String.valueOf(payload.consentLaser()))
                .putMetadata("consentPmu", String.valueOf(payload.consentPmu()));

        if (payload.notes() != null && !payload.notes().isBlank()) {
            String notes = payload.notes().length() > 490
                    ? payload.notes().substring(0, 490) : payload.notes();
            builder.putMetadata("notes", notes);
        }

        // Fix 11: when any line used an option, hand the webhook the option-aware services subtotal
        // (cents) so it records the correct appointment total via Booking.customTotalPrice — no schema,
        // no re-resolving options. Omitted for all-base carts → those stay byte-identical to before.
        if (anyOption) {
            builder.putMetadata("servicesTotalCents",
                    String.valueOf(servicesTotal.movePointRight(2).longValueExact()));
            // Fix 15: per-line option ids, index-aligned to serviceIds (empty token = no option on that
            // line, e.g. "optA,,optC"). The webhook persists each as booking_services.option_id so the
            // same service added with different options stays distinguishable. Emitted only alongside
            // servicesTotalCents (option carts) → all-base carts stay byte-identical (no extra key).
            builder.putMetadata("serviceOptionIds",
                    lineOptions.stream()
                            .map(o -> o == null ? "" : o.getOptionId().toString())
                            .collect(Collectors.joining(",")));
        }

        for (int i = 0; i < services.size(); i++) {
            ServiceItem svc = services.get(i);
            ServiceOption option = lineOptions.get(i);
            BigDecimal unitPrice = (option != null) ? option.getPrice() : svc.getPrice();
            String lineName = svc.getTitle() + (option != null ? " — " + option.getName() : "");
            builder.addLineItem(
                    SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
                            .setPriceData(
                                    SessionCreateParams.LineItem.PriceData.builder()
                                            .setCurrency("eur")
                                            .setUnitAmount(unitPrice.movePointRight(2).longValueExact())
                                            .setProductData(
                                                    SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                            .setName(lineName)
                                                            .build()
                                            )
                                            .build()
                            )
                            .build()
            );
        }

        // Fix 3 (mixed cart): charge the cart's products through the SAME Stripe session and carry
        // them to the webhook via metadata. Price/stock come from the Product entity (never the
        // client). The charged unit amount (cents) is echoed into the metadata so the webhook records
        // EXACTLY what was charged — no drift if the catalog price changes mid-checkout. Promo carts
        // never reach here (the promo early-return above handles them), so products stay non-promo.
        if (payload.products() != null && !payload.products().isEmpty()) {
            StringBuilder productsMeta = new StringBuilder();
            for (ProductEntryDTO entry : payload.products()) {
                if (entry == null || entry.productId() == null) continue;
                int qty = Math.max(1, entry.quantity());
                Product product = productRepository.findById(entry.productId())
                        .orElseThrow(() -> new BadRequestException("Prodotto non trovato."));
                if (!product.isActive()) {
                    throw new BadRequestException("Il prodotto '" + product.getName() + "' non è disponibile.");
                }
                if (product.getPrice() == null || product.getPrice().signum() <= 0) {
                    throw new BadRequestException("Il prodotto '" + product.getName() + "' non ha un prezzo valido.");
                }
                if (product.getStock() < qty) {
                    throw new BadRequestException(
                            "Prodotto '" + product.getName() + "' non disponibile nella quantità richiesta.");
                }
                long unitAmountCents = product.getPrice().movePointRight(2).longValueExact();

                builder.addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setQuantity((long) qty)
                                .setPriceData(
                                        SessionCreateParams.LineItem.PriceData.builder()
                                                .setCurrency("eur")
                                                .setUnitAmount(unitAmountCents)
                                                .setProductData(
                                                        SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                .setName(product.getName())
                                                                .build()
                                                )
                                                .build()
                                )
                                .build()
                );

                if (productsMeta.length() > 0) productsMeta.append(",");
                productsMeta.append(entry.productId()).append(":").append(qty).append(":").append(unitAmountCents);
            }
            // Stripe metadata values cap at 500 chars. A token is ~48 chars (uuid:qty:cents), so ~10
            // products fit — far beyond a real cart. Reject rather than silently truncate (would drop a
            // paid product from the agenda).
            if (productsMeta.length() > 480) {
                throw new BadRequestException("Troppi prodotti nel carrello per il checkout online.");
            }
            if (productsMeta.length() > 0) {
                builder.putMetadata("products", productsMeta.toString());
            }
        }

        Session session = Session.create(builder.build());

        Map<String, Object> resp = new HashMap<>();
        resp.put("url", session.getUrl());
        return resp;
    }

    /**
     * 08.4: builds the Stripe session for a PROMO booking (one or more treatments at a discount).
     * The amount comes from the SAME source the webhook will snapshot
     * ({@link BookingService#computePromoBundleTotal}), so the charge equals the recorded snapshot.
     * No serviceIds metadata — the webhook derives the services from the promo itself.
     */
    private Map<String, Object> createPromoMultiSession(PublicMultiServiceBookingDTO payload) throws StripeException {
        Promotion promo = promotionRepository.findByIdWithDetails(payload.promotionId())
                .orElseThrow(() -> new BadRequestException("Promozione non trovata."));
        if (!promo.isCurrentlyActive()) throw new BadRequestException("Promozione non più attiva.");
        if (promo.getServices().isEmpty())
            throw new BadRequestException("Questa promozione non include trattamenti prenotabili online.");

        BigDecimal amount = bookingService.computePromoBundleTotal(promo); // same source as the snapshot
        if (amount == null || amount.signum() <= 0) throw new BadRequestException("Promozione non applicabile.");

        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setExpiresAt(Instant.now().plusSeconds(30 * 60L).getEpochSecond())
                .setSuccessUrl(frontendUrl + "/prenotazione-confermata?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(frontendUrl + "/occasioni?cancel=1&tab=promozioni&promo=" + promo.getPromotionId())
                .setCustomerEmail(payload.customerEmail())
                .putMetadata("bookingType", "MULTI")
                .putMetadata("promotionId", promo.getPromotionId().toString())
                .putMetadata("date", payload.date().toString())
                .putMetadata("startTime", payload.startTime().toString())
                .putMetadata("totalDurationMinutes", String.valueOf(payload.totalDurationMinutes()))
                .putMetadata("customerName", payload.customerName())
                .putMetadata("customerPhone", payload.customerPhone() != null ? payload.customerPhone() : "");

        if (payload.notes() != null && !payload.notes().isBlank()) {
            String notes = payload.notes().length() > 490
                    ? payload.notes().substring(0, 490) : payload.notes();
            builder.putMetadata("notes", notes);
        }

        // Single bundled line item — the discount applies to the whole promo (mirrors the single-service promo).
        builder.addLineItem(
                SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(
                                SessionCreateParams.LineItem.PriceData.builder()
                                        .setCurrency("eur")
                                        .setUnitAmount(amount.movePointRight(2).longValueExact())
                                        .setProductData(
                                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                        .setName(promo.getTitle() + " (Promozione)")
                                                        .build()
                                        )
                                        .build()
                        )
                        .build()
        );

        Session session = Session.create(builder.build());

        Map<String, Object> resp = new HashMap<>();
        resp.put("url", session.getUrl());
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
        Map<String, String> meta = session.getMetadata();
        String bookingIdStr = meta != null ? meta.get("bookingId") : null;
        String bookingType  = meta != null ? meta.get("bookingType") : null;

        BookingResponseDTO booking;
        if (bookingIdStr != null) {
            UUID bookingId = UUID.fromString(bookingIdStr);
            booking = bookingService.findBookingByIdAndConvert(bookingId);
        } else if ("MULTI".equals(bookingType)) {
            // Multi-service: no pre-hold, booking created by webhook — look up by stripeSessionId
            booking = bookingRepository.findByStripeSessionId(session.getId())
                    .map(b -> bookingService.findBookingByIdAndConvert(b.getBookingId()))
                    .orElse(null);
            if (booking == null) {
                // Webhook may not have fired yet; return a pending placeholder
                return ResponseEntity.ok(new BookingSummaryDTO(null, isPaid ? "PAID" : "PENDING", session.getCustomerDetails() != null ? session.getCustomerDetails().getEmail() : null));
            }
        } else {
            return ResponseEntity.status(400).body(BookingSummaryDTO.error("bookingId assente nei metadata della sessione"));
        }

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

        return PricingUtils.roundPromoPrice(discounted);
    }
}