package daviderocca.CAPSTONE_BACKEND.controllers;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.BookingSummaryDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceOption;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.repositories.ServiceOptionRepository;
import daviderocca.CAPSTONE_BACKEND.services.BookingService;
import daviderocca.CAPSTONE_BACKEND.services.ServiceItemService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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

    // mettiti una env/config FRONT_URL così non hardcodi localhost in prod
    @Value("${app.front.url:http://localhost:5173}")
    private String frontUrl;

    private final BookingService bookingService;
    private final ServiceItemService serviceItemService;
    private final ServiceOptionRepository serviceOptionRepository;

    @PostMapping("/create-session")
    public Map<String, Object> createSessionAuth(
            @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) throws StripeException {

        Stripe.apiKey = stripeSecretKey;

        if (currentUser == null) throw new BadRequestException("Utente non autenticato.");

        // Forzo email dal profilo, ma lascio nome/telefono dal payload (se vuoi puoi forzare anche quelli)
        NewBookingDTO dto = new NewBookingDTO(
                payload.customerName(),
                currentUser.getEmail(),
                payload.customerPhone(),
                payload.startTime(),
                payload.notes(),
                payload.serviceId(),
                payload.serviceOptionId()
        );

        return createStripeSessionForBooking(dto, currentUser);
    }

    // PUBLIC (guest)
    @PostMapping("/create-session-guest")
    public Map<String, Object> createSessionGuest(@RequestBody NewBookingDTO payload) throws StripeException {
        Stripe.apiKey = stripeSecretKey;
        return createStripeSessionForBooking(payload, null);
    }

    private Map<String, Object> createStripeSessionForBooking(NewBookingDTO payload, User currentUserOrNull) throws StripeException {

        // 1) crea HOLD booking (blocca slot per N minuti)
        BookingResponseDTO hold = bookingService.createHoldBooking(payload, currentUserOrNull);

        // 2) calcola prezzo: option.price se presente, altrimenti service.price
        ServiceItem service = serviceItemService.findServiceItemById(payload.serviceId());
        ServiceOption option = null;
        if (payload.serviceOptionId() != null) {
            option = serviceOptionRepository.findById(payload.serviceOptionId())
                    .orElseThrow(() -> new BadRequestException("Opzione non trovata."));
        }

        BigDecimal amount = (option != null ? option.getPrice() : service.getPrice());
        if (amount == null || amount.signum() <= 0) throw new BadRequestException("Prezzo non valido.");

        int sessionsTotal = (option != null && option.getSessions() != null ? option.getSessions() : 1);

        // 3) crea session Stripe
        String bookingId = hold.bookingId().toString();

        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontUrl + "/booking-confermato?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(frontUrl + "/prenota?cancel=1")
                .putMetadata("bookingId", bookingId)
                .putMetadata("serviceId", service.getServiceId().toString())
                .putMetadata("sessionsTotal", String.valueOf(sessionsTotal))
                .setCustomerEmail(payload.customerEmail())
                .setPaymentIntentData(
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
                                                        .setName(service.getTitle() + (option != null ? " - " + option.getName() : ""))
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

    @GetMapping("/booking-summary")
    public ResponseEntity<BookingSummaryDTO> getBookingSummary(@RequestParam("session_id") String sessionId) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        Session session = Session.retrieve(sessionId);

        boolean isPaid = "paid".equalsIgnoreCase(session.getPaymentStatus());
        String bookingIdStr = session.getMetadata() != null ? session.getMetadata().get("bookingId") : null;

        if (bookingIdStr == null) {
            return ResponseEntity.status(400).body(BookingSummaryDTO.error("bookingId assente nei metadata della sessione"));
        }

        UUID bookingId = UUID.fromString(bookingIdStr);
        BookingResponseDTO booking = bookingService.findBookingByIdAndConvert(bookingId);

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
}