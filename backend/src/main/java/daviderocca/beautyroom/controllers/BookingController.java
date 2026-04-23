package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.ConsentSignedDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.services.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
@Slf4j
public class BookingController {

    private final BookingService bookingService;

    // ---------------------------------- AUTH GET ----------------------------------
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<BookingResponseDTO>> getMyBookings(@AuthenticationPrincipal User currentUser) {
        log.info("AUTH | my bookings | user={}", currentUser.getUserId());
        return ResponseEntity.ok(bookingService.findBookingsForCurrentUser(currentUser));
    }

    // ---------------------------------- ADMIN POST (agenda manual create) ----------------------------------
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BookingResponseDTO> createBookingFromAdmin(
            @Valid @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("ADMIN | agenda create booking for {} ({})", payload.customerEmail(), payload.customerName());
        BookingResponseDTO created = bookingService.createManualConfirmedBookingAsAdmin(payload, currentUser);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- ADMIN: firma consenso PMU ----------------------------------
    @PatchMapping("/{bookingId}/consent")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminBookingCardDTO> signConsent(
            @PathVariable UUID bookingId,
            @Valid @RequestBody ConsentSignedDTO body
    ) {
        if (!Boolean.TRUE.equals(body.signed())) {
            return ResponseEntity.badRequest().build();
        }
        log.info("ADMIN | sign PMU consent | bookingId={}", bookingId);
        return ResponseEntity.ok(bookingService.signConsent(bookingId));
    }

    // ---------------------------------- ADMIN: prenotazioni PMU da firmare ----------------------------------
    @GetMapping("/pmu-unsigned")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AdminBookingCardDTO>> getPmuUnsigned() {
        log.info("ADMIN | pmu-unsigned bookings");
        return ResponseEntity.ok(bookingService.findPmuUnsigned());
    }

    // ---------------------------------- ADMIN: no-show ----------------------------------
    @PatchMapping("/{bookingId}/no-show")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> markNoShow(@PathVariable UUID bookingId) {
        log.info("ADMIN | no-show bookingId={}", bookingId);
        bookingService.markAsNoShow(bookingId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/user/{userId}/no-show")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> markLatestNoShowForUser(@PathVariable UUID userId) {
        log.info("ADMIN | no-show latest for user={}", userId);
        bookingService.markLatestNoShowForUser(userId);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------- AUTH DELETE (cancel) ----------------------------------
    @DeleteMapping("/{bookingId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> cancelBooking(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String reason
    ) {
        log.info("AUTH | cancel booking {} reason={}", bookingId, reason);
        bookingService.cancelBooking(bookingId, currentUser, reason);
        return ResponseEntity.noContent().build();
    }
}
