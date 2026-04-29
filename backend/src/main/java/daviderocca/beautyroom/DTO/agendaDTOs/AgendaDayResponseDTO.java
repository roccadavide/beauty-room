package daviderocca.beautyroom.DTO.agendaDTOs;

import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentDTO;

import java.util.List;

/**
 * Combined agenda response for a single day.
 * Returned by GET /admin/agenda/day-full?date=YYYY-MM-DD
 *
 * The existing GET /admin/bookings/day is left completely untouched.
 * This wrapper is purely additive.
 */
public record AgendaDayResponseDTO(
        List<AdminBookingCardDTO> bookings,
        List<PersonalAppointmentDTO> personalAppointments
) {}
