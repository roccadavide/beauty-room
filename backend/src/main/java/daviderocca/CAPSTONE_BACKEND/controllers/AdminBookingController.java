package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.services.BookingService;
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

    // DELETE BOOKING
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBooking(
            @PathVariable UUID id,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("ADMIN | delete bookingId={}", id);
        bookingService.deleteBooking(id, currentUser);
        return ResponseEntity.noContent().build();
    }
}