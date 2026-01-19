package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.services.BookingService;
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

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<BookingResponseDTO>> getMyBookings(@AuthenticationPrincipal User currentUser) {
        log.info("AUTH | my bookings | user={}", currentUser.getUserId());
        return ResponseEntity.ok(bookingService.findBookingsForCurrentUser(currentUser));
    }

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