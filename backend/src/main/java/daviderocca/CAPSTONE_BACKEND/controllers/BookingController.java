package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.services.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
@Slf4j
public class BookingController {

    private final BookingService bookingService;

    // PUBBLICO

    // MY BOOKINGS (AUTH) - GET /bookings/me
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<BookingResponseDTO>> getMyBookings(
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("AUTH | my bookings | user={}", currentUser.getUserId());
        return ResponseEntity.ok(bookingService.findBookingsForCurrentUser(currentUser));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BookingResponseDTO> createBooking(
            @Valid @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("AUTH | create booking | userId={}", currentUser.getUserId());
        BookingResponseDTO created = bookingService.saveBookingAsUser(payload, currentUser);

        URI location = URI.create("/bookings/" + created.bookingId());
        return ResponseEntity.created(location).body(created);
    }

    // UPDATE
    @PutMapping("/{bookingId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BookingResponseDTO> updateBooking(
            @PathVariable UUID bookingId,
            @Valid @RequestBody NewBookingDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("AUTH | update booking {}", bookingId);
        return ResponseEntity.ok(bookingService.updateBooking(bookingId, payload, currentUser));
    }

    // DELETE
    @DeleteMapping("/{bookingId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteBooking(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("AUTH | delete booking {}", bookingId);
        bookingService.deleteBooking(bookingId, currentUser);
        return ResponseEntity.noContent().build();
    }
}