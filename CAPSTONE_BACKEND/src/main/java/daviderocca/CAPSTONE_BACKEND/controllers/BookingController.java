package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.BookingService;
import jakarta.validation.constraints.NotBlank;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.BindingResult;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/bookings")
@Slf4j
public class BookingController {

    @Autowired
    private BookingService bookingService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping("/getAll")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('ADMIN')")
    public Page<BookingResponseDTO> getAllBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "startTime") String sort
    ) {
        log.info("Richiesta elenco prenotazioni - pagina: {}, size: {}, sort: {}", page, size, sort);
        return bookingService.findAllBookings(page, size, sort);
    }

    @GetMapping("/{bookingId}")
    @ResponseStatus(HttpStatus.OK)
    public BookingResponseDTO getBookingById(@PathVariable UUID bookingId) {
        log.info("Richiesta dettaglio prenotazione {}", bookingId);
        return bookingService.findBookingByIdAndConvert(bookingId);
    }

    @GetMapping("/email/{email}")
    @ResponseStatus(HttpStatus.OK)
    public List<BookingResponseDTO> getBookingsByEmail(@PathVariable String email) {
        log.info("Richiesta prenotazione per email {}", email);
        return bookingService.findBookingByEmailAndConvert(email);
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookingResponseDTO createBooking(@Validated @RequestBody NewBookingDTO payload,
                                            Authentication authentication,
                                            BindingResult bindingResult) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        User currentUser = authentication != null ? (User) authentication.getPrincipal() : null;

        log.info("Richiesta creazione prenotazione {}", payload.customerEmail());
        return bookingService.saveBooking(payload, currentUser);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{bookingId}")
    @ResponseStatus(HttpStatus.OK)
    public BookingResponseDTO updateBooking(
            @PathVariable UUID bookingId,
            @Validated @RequestBody NewBookingDTO payload,
            Authentication authentication,
            BindingResult bindingResult
    ) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        User currentUser = authentication != null ? (User) authentication.getPrincipal() : null;

        log.info("Richiesta aggiornamento prenotazione {}", bookingId);
        return bookingService.findBookingByIdAndUpdate(bookingId, payload, currentUser);
    }

    // ---------------------------------- PATCH ----------------------------------


    @PatchMapping("/{bookingId}/status")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('ADMIN')")
    public BookingResponseDTO updateBookingStatus(
            @PathVariable UUID bookingId,
            @RequestParam @NotBlank BookingStatus status
    ) {
        log.info("Richiesta aggiornamento status prenotazione {} -> {}", bookingId, status);
        return bookingService.updateBookingStatus(bookingId, status);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{bookingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBooking(@PathVariable UUID bookingId, Authentication authentication) {

        User currentUser = authentication != null ? (User) authentication.getPrincipal() : null;

        log.info("Richiesta eliminazione prenotazione {}", bookingId);
        bookingService.findBookingByIdAndDelete(bookingId, currentUser);
    }
}