package daviderocca.beautyroom;

import daviderocca.beautyroom.DTO.availabilityDTOs.AvailabilityResponseDTO;
import daviderocca.beautyroom.DTO.availabilityDTOs.AvailabilitySlotDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.WorkingHours;
import daviderocca.beautyroom.personalappointments.PersonalAppointment;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ClosureRepository;
import daviderocca.beautyroom.repositories.WorkingHoursRepository;
import daviderocca.beautyroom.services.AvailabilityService;
import daviderocca.beautyroom.services.ServiceItemService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Slot-availability parity tests (Fix 1).
 *
 * The single-service tests PIN the output of {@link AvailabilityService#getServiceAvailabilities}
 * so the {@code generateAllSlots} parameterization (added for combined availability) can never
 * silently change the reference "Prenota ora" behavior — step stays == duration there.
 *
 * The combined tests assert the new {@link AvailabilityService#getCombinedAvailabilities} returns
 * the SAME contract: ALL slots flagged available, on a fixed 10-minute grid, EMPTY only when truly
 * closed (an open-but-fully-booked day returns a non-empty list of occupied slots — the bug fixed).
 *
 * A future date is used everywhere so {@code requestedDate.equals(today)} is false and the
 * "now + 30min" earliest-start clamp never makes the output time-dependent.
 */
@ExtendWith(MockitoExtension.class)
class AvailabilityServiceTest {

    @Mock private WorkingHoursRepository workingHoursRepository;
    @Mock private ClosureRepository closureRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private ServiceItemService serviceItemService;
    @Mock private PersonalAppointmentRepository personalAppointmentRepository;

    @InjectMocks private AvailabilityService availabilityService;

    private static final LocalDate FUTURE =
            LocalDate.now(AvailabilityService.BUSINESS_ZONE).plusDays(30);

    private WorkingHours openMorning() {
        // Open 09:00–12:00, no afternoon, not closed.
        return new WorkingHours(FUTURE.getDayOfWeek(),
                LocalTime.of(9, 0), LocalTime.of(12, 0), null, null, false);
    }

    private Booking bookingBetween(int startHour, int endHour) {
        Booking b = mock(Booking.class);
        when(b.getStartTime()).thenReturn(FUTURE.atTime(startHour, 0));
        when(b.getEndTime()).thenReturn(FUTURE.atTime(endHour, 0));
        when(b.getPaddingMinutes()).thenReturn(0);
        return b;
    }

    // ====================== SINGLE-SERVICE (reference) — must NOT change ======================

    @Test
    @DisplayName("Single-service: full open morning → 3 hourly slots, all available (step == duration)")
    void singleService_outputUnchanged_noBookings() {
        ServiceItem svc = mock(ServiceItem.class);
        when(svc.getDurationMin()).thenReturn(60);
        when(serviceItemService.findServiceItemById(any())).thenReturn(svc);
        when(workingHoursRepository.findByDayOfWeek(any())).thenReturn(Optional.of(openMorning()));
        when(closureRepository.findOverlappingDate(any())).thenReturn(List.of());
        when(bookingRepository.findBookingsByStatusesIntersectingRange(any(), any(), any()))
                .thenReturn(List.of());

        AvailabilityResponseDTO resp = availabilityService.getServiceAvailabilities(UUID.randomUUID(), FUTURE);

        assertThat(resp.stepMinutes()).isEqualTo(60);
        assertThat(resp.slots()).extracting(AvailabilitySlotDTO::start)
                .containsExactly("09:00", "10:00", "11:00");
        assertThat(resp.slots()).extracting(AvailabilitySlotDTO::end)
                .containsExactly("10:00", "11:00", "12:00");
        assertThat(resp.slots()).allMatch(AvailabilitySlotDTO::available);
    }

    @Test
    @DisplayName("Single-service: a 10:00–11:00 booking marks only that slot occupied (others free)")
    void singleService_outputUnchanged_withBooking() {
        ServiceItem svc = mock(ServiceItem.class);
        when(svc.getDurationMin()).thenReturn(60);
        when(serviceItemService.findServiceItemById(any())).thenReturn(svc);
        when(workingHoursRepository.findByDayOfWeek(any())).thenReturn(Optional.of(openMorning()));
        when(closureRepository.findOverlappingDate(any())).thenReturn(List.of());
        Booking booking = bookingBetween(10, 11); // build the mock BEFORE stubbing the repo (no nested stubbing)
        when(bookingRepository.findBookingsByStatusesIntersectingRange(any(), any(), any()))
                .thenReturn(List.of(booking));

        AvailabilityResponseDTO resp = availabilityService.getServiceAvailabilities(UUID.randomUUID(), FUTURE);

        assertThat(resp.slots()).extracting(AvailabilitySlotDTO::start)
                .containsExactly("09:00", "10:00", "11:00");
        assertThat(resp.slots().get(0).available()).isTrue();
        assertThat(resp.slots().get(1).available()).isFalse();
        assertThat(resp.slots().get(2).available()).isTrue();
    }

    // ====================== COMBINED (multi-service cart) ======================

    @Test
    @DisplayName("Combined: 90-min block on 09:00–12:00 → 10:30 last start, 10-min grid, all free")
    void combined_grid10_fitsFullDuration() {
        when(workingHoursRepository.findByDayOfWeek(any())).thenReturn(Optional.of(openMorning()));
        when(closureRepository.findOverlappingDate(any())).thenReturn(List.of());
        when(bookingRepository.findBookingsByStatusesIntersectingRange(any(), any(), any()))
                .thenReturn(List.of());
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(any()))
                .thenReturn(List.of());

        AvailabilityResponseDTO resp = availabilityService.getCombinedAvailabilities(FUTURE, 90);

        assertThat(resp.stepMinutes()).isEqualTo(10);
        assertThat(resp.slots()).hasSize(10); // 09:00 .. 10:30 step 10
        assertThat(resp.slots().get(0).start()).isEqualTo("09:00");
        assertThat(resp.slots().get(0).end()).isEqualTo("10:30");
        assertThat(resp.slots().get(9).start()).isEqualTo("10:30");
        assertThat(resp.slots().get(9).end()).isEqualTo("12:00");
        assertThat(resp.slots()).allMatch(AvailabilitySlotDTO::available);
    }

    @Test
    @DisplayName("Combined: open-but-fully-booked day → NON-empty list, every slot occupied (the bug fix)")
    void combined_openButFull_returnsOccupiedSlotsNotEmpty() {
        when(workingHoursRepository.findByDayOfWeek(any())).thenReturn(Optional.of(openMorning()));
        when(closureRepository.findOverlappingDate(any())).thenReturn(List.of());
        Booking booking = bookingBetween(9, 12); // whole day booked — build mock BEFORE stubbing the repo
        when(bookingRepository.findBookingsByStatusesIntersectingRange(any(), any(), any()))
                .thenReturn(List.of(booking));
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(any()))
                .thenReturn(List.of());

        AvailabilityResponseDTO resp = availabilityService.getCombinedAvailabilities(FUTURE, 90);

        assertThat(resp.slots()).isNotEmpty();
        assertThat(resp.slots()).noneMatch(AvailabilitySlotDTO::available);
    }

    @Test
    @DisplayName("Combined: truly-closed day → empty slot list")
    void combined_closedDay_returnsEmpty() {
        WorkingHours closed = new WorkingHours(FUTURE.getDayOfWeek(), null, null, null, null, true);
        when(workingHoursRepository.findByDayOfWeek(any())).thenReturn(Optional.of(closed));

        AvailabilityResponseDTO resp = availabilityService.getCombinedAvailabilities(FUTURE, 90);

        assertThat(resp.slots()).isEmpty();
    }

    @Test
    @DisplayName("Combined: a personal appointment blocks slots too (no double-booking Michela's time)")
    void combined_personalAppointmentBlocks() {
        PersonalAppointment pa = mock(PersonalAppointment.class);
        when(pa.getStartTime()).thenReturn(LocalTime.of(9, 0));
        when(pa.getDurationMinutes()).thenReturn(180); // 09:00–12:00
        when(workingHoursRepository.findByDayOfWeek(any())).thenReturn(Optional.of(openMorning()));
        when(closureRepository.findOverlappingDate(any())).thenReturn(List.of());
        when(bookingRepository.findBookingsByStatusesIntersectingRange(any(), any(), any()))
                .thenReturn(List.of());
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(any()))
                .thenReturn(List.of(pa));

        AvailabilityResponseDTO resp = availabilityService.getCombinedAvailabilities(FUTURE, 90);

        assertThat(resp.slots()).isNotEmpty();
        assertThat(resp.slots()).noneMatch(AvailabilitySlotDTO::available);
    }
}
