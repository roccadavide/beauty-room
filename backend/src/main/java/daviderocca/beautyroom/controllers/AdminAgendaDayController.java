package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.agendaDTOs.AgendaDayResponseDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentDTO;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentService;
import daviderocca.beautyroom.services.BookingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * New combined agenda endpoint.
 * GET /admin/agenda/day-full?date=YYYY-MM-DD
 *
 * Returns both client bookings (from BookingService) and Michela's personal
 * appointments in a single response.
 *
 * The existing endpoints on AdminBookingController and AvailabilityController
 * are NOT modified.
 */
@RestController
@RequestMapping("/admin/agenda")
@PreAuthorize("hasAnyRole('ADMIN','STAFF')")
@RequiredArgsConstructor
@Slf4j
public class AdminAgendaDayController {

    private final BookingService bookingService;
    private final PersonalAppointmentService personalAppointmentService;

    @GetMapping("/day-full")
    public ResponseEntity<AgendaDayResponseDTO> getDayFull(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        log.info("ADMIN | agenda day-full date={}", date);

        List<AdminBookingCardDTO> bookings = bookingService.getAgendaDay(date);
        List<PersonalAppointmentDTO> personal = personalAppointmentService.findByDate(date);

        return ResponseEntity.ok(new AgendaDayResponseDTO(bookings, personal));
    }
}
