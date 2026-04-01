package daviderocca.beautyroom.controllers;

import com.stripe.exception.StripeException;
import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.NextAvailableSlotDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.services.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/bookings")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ADMIN')")
public class AdminBookingController {

    private final BookingService bookingService;

    // LIST PAGINATA
    @GetMapping
    public ResponseEntity<Page<BookingResponseDTO>> getAllBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "startTime") String sort
    ) {
        log.info("ADMIN | list bookings page={} size={} sort={}", page, size, sort);
        return ResponseEntity.ok(bookingService.findAllBookings(page, size, sort));
    }

    // DETTAGLIO
    @GetMapping("/{bookingId}")
    public ResponseEntity<BookingResponseDTO> getBookingById(@PathVariable UUID bookingId) {
        log.info("ADMIN | detail bookingId={}", bookingId);
        return ResponseEntity.ok(bookingService.findBookingByIdAndConvert(bookingId));
    }

    // RICERCA PER EMAIL
    @GetMapping("/by-email")
    public ResponseEntity<List<BookingResponseDTO>> getBookingsByEmail(@RequestParam String email) {
        log.info("ADMIN | by-email {}", email);
        return ResponseEntity.ok(bookingService.findBookingByEmailAndConvert(email));
    }

    // AGENDA DAY (card complete)
    @GetMapping("/day")
    public ResponseEntity<List<AdminBookingCardDTO>> getAgendaDay(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        log.info("ADMIN | agenda day date={}", date);
        return ResponseEntity.ok(bookingService.getAgendaDay(date));
    }

    // AGENDA RANGE (to EXCLUSIVE)
    @GetMapping("/range")
    public ResponseEntity<List<AdminBookingCardDTO>> getAgendaRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        log.info("ADMIN | agenda range from={} to={}", from, to);
        return ResponseEntity.ok(bookingService.getAgendaRange(from, to));
    }

    @GetMapping("/next-available")
    public ResponseEntity<?> nextAvailable(
            @RequestParam int durationMin,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime after
    ) {
        if (durationMin < 15 || durationMin > 480) {
            return ResponseEntity.badRequest().body("durationMin must be between 15 and 480.");
        }
        LocalDateTime searchAfter = (after != null) ? after : LocalDateTime.now();
        NextAvailableSlotDTO result = bookingService.findNextAvailableSlot(durationMin, searchAfter);
        if (result == null) {
            return ResponseEntity.ok(Map.of("found", false));
        }
        return ResponseEntity.ok(Map.of("found", true, "slot", result));
    }


    @PostMapping("/manual")
    public ResponseEntity<BookingResponseDTO> createManualBooking(
            @Valid @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("ADMIN | manual create booking | email={}", payload.customerEmail());
        BookingResponseDTO created = bookingService.createManualConfirmedBookingAsAdmin(payload, currentUser);

        return ResponseEntity
                .created(java.net.URI.create("/admin/bookings/" + created.bookingId()))
                .body(created);
    }


    // PATCH STATUS
    @PatchMapping("/{id}/status")
    public ResponseEntity<BookingResponseDTO> updateStatus(
            @PathVariable UUID id,
            @RequestParam BookingStatus status,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("ADMIN | update status bookingId={} -> {}", id, status);
        return ResponseEntity.ok(bookingService.updateBookingStatus(id, status, currentUser));
    }

    @PatchMapping("/{id}/padding")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> updatePadding(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer minutes,
            @AuthenticationPrincipal User currentUser) {

        Booking booking = bookingService.findBookingById(id);
        booking.setPaddingMinutes(minutes != null && minutes > 0 ? minutes : null);
        bookingService.save(booking);
        return ResponseEntity.noContent().build();
    }

    // UPDATE BOOKING (sposta orario / cambia servizio / note)
    @PutMapping("/{id}")
    public ResponseEntity<BookingResponseDTO> updateBooking(
            @PathVariable UUID id,
            @Valid @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("ADMIN | update bookingId={}", id);
        return ResponseEntity.ok(bookingService.updateBooking(id, payload, currentUser));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> hardDeleteBooking(
            @PathVariable UUID id,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("ADMIN | hard delete bookingId={}", id);
        bookingService.hardDeleteBooking(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    // FIX-1: rimborso Stripe per prenotazioni pagate online
    // Recupera payment_intent dalla sessione, crea Refund, aggiorna status a CANCELLED
    @PostMapping("/{id}/refund")
    public ResponseEntity<BookingResponseDTO> refundBooking(@PathVariable UUID id) throws StripeException {
        log.info("ADMIN | refund bookingId={}", id);
        bookingService.refundBooking(id);
        return ResponseEntity.ok(bookingService.findBookingByIdAndConvert(id));
    }
}