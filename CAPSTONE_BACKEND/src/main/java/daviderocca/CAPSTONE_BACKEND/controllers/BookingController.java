package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.services.BookingService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/bookings")
@Slf4j
public class BookingController {

    @Autowired
    private BookingService bookingService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<BookingResponseDTO>> getAllBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "startTime") String sort
    ) {
        log.info("Richiesta elenco prenotazioni [page={}, size={}, sort={}]", page, size, sort);
        return ResponseEntity.ok(bookingService.findAllBookings(page, size, sort));
    }

    @GetMapping("/{bookingId}")
    public ResponseEntity<BookingResponseDTO> getBookingById(@PathVariable UUID bookingId) {
        log.info("Richiesta dettaglio prenotazione {}", bookingId);
        return ResponseEntity.ok(bookingService.findBookingByIdAndConvert(bookingId));
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<List<BookingResponseDTO>> getBookingsByEmail(@PathVariable String email) {
        log.info("Richiesta elenco prenotazioni per email {}", email);
        return ResponseEntity.ok(bookingService.findBookingByEmailAndConvert(email));
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping
    public ResponseEntity<BookingResponseDTO> createBooking(
            @Valid @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("Richiesta creazione prenotazione per {}", payload.customerEmail());
        BookingResponseDTO created = bookingService.saveBooking(payload, currentUser);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{bookingId}")
    public ResponseEntity<BookingResponseDTO> updateBooking(
            @PathVariable UUID bookingId,
            @Valid @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("Richiesta aggiornamento prenotazione {}", bookingId);
        BookingResponseDTO updated = bookingService.updateBooking(bookingId, payload, currentUser);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- PATCH ----------------------------------

    @PatchMapping("/{bookingId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BookingResponseDTO> updateBookingStatus(
            @PathVariable UUID bookingId,
            @RequestParam BookingStatus status
    ) {
        log.info("Richiesta aggiornamento stato prenotazione {} -> {}", bookingId, status);
        BookingResponseDTO updated = bookingService.updateBookingStatus(bookingId, status);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{bookingId}")
    public ResponseEntity<Void> deleteBooking(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("Richiesta eliminazione prenotazione {}", bookingId);
        bookingService.deleteBooking(bookingId, currentUser);
        return ResponseEntity.noContent().build();
    }
}