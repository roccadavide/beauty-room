package daviderocca.beautyroom;

import daviderocca.beautyroom.DTO.bookingDTOs.NextAvailableSlotDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.WorkingHours;
import daviderocca.beautyroom.personalappointments.PersonalAppointment;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ClosureRepository;
import daviderocca.beautyroom.repositories.WorkingHoursRepository;
import daviderocca.beautyroom.services.BookingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Admin "prossimo disponibile" finder tests (prompt 05 — PersonalAppointment gap fix).
 *
 * {@link BookingService#findNextAvailableSlot} previously built its occupancy set from bookings +
 * closures only, so it happily offered a slot sitting on top of one of Michela's personal blocks.
 * These tests pin the fixed behavior on single-staff semantics:
 *  - a booking and a PA occupying the SAME interval push the finder to the SAME next slot (parity);
 *  - a PA landing in the extend-past-hours window (§0.2) blocks that extended slot too.
 *
 * A future date is used everywhere and {@code maxAdvanceDays == 1}, so the finder only scans day 0:
 * the result (or its absence) is fully determined by that single day's fixtures — no time-of-day or
 * roll-to-next-day nondeterminism. {@code workingHoursRepository.findByDayOfWeek(any())} returns the
 * same open ranges for whatever weekday the future date lands on.
 */
@ExtendWith(MockitoExtension.class)
class BookingServiceFinderTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private WorkingHoursRepository workingHoursRepository;
    @Mock private ClosureRepository closureRepository;
    @Mock private PersonalAppointmentRepository personalAppointmentRepository;

    @InjectMocks private BookingService bookingService;

    private static final LocalDate FUTURE =
            LocalDate.now(daviderocca.beautyroom.services.AvailabilityService.BUSINESS_ZONE).plusDays(30);
    // Scan only day 0 so a "no slot" outcome is a real null, not a roll to the next open day.
    private static final LocalDateTime AFTER = FUTURE.atStartOfDay();

    @BeforeEach
    void setUp() {
        // @Value fields are not populated by @InjectMocks (no Spring context) → default 0, which
        // would make the finder's day loop never run. Pin it to 1 (day-0-only) for determinism.
        ReflectionTestUtils.setField(bookingService, "maxAdvanceDays", 1);
    }

    /** Open 09:00–12:00 (no afternoon), not closed — for whatever weekday the future date is. */
    private WorkingHours openMorning() {
        return new WorkingHours(FUTURE.getDayOfWeek(),
                LocalTime.of(9, 0), LocalTime.of(12, 0), null, null, false);
    }

    private void stubOpenDayNoClosures() {
        when(workingHoursRepository.findByDayOfWeek(any())).thenReturn(java.util.Optional.of(openMorning()));
        when(closureRepository.findOverlappingDate(any())).thenReturn(List.of());
    }

    /** Booking mock the finder can read (start/end/padding). Mutable list so the finder can sort it. */
    private Booking bookingBetween(int startHour, int endHour) {
        Booking b = mock(Booking.class);
        when(b.getStartTime()).thenReturn(FUTURE.atTime(startHour, 0));
        when(b.getEndTime()).thenReturn(FUTURE.atTime(endHour, 0));
        when(b.getPaddingMinutes()).thenReturn(0);
        return b;
    }

    private PersonalAppointment paBetween(LocalTime start, int durationMinutes) {
        PersonalAppointment pa = new PersonalAppointment();
        pa.setAppointmentDate(FUTURE);
        pa.setStartTime(start);
        pa.setDurationMinutes(durationMinutes);
        pa.setTitle("Personale");
        return pa;
    }

    // ====================== REGRESSION: bookings/closures-only fixture is unchanged ======================

    @Test
    @DisplayName("Finder: empty day (no bookings, no PA) → first slot at open time (regression baseline)")
    void finder_emptyDay_returnsFirstSlot() {
        stubOpenDayNoClosures();
        when(bookingRepository.findByDateAndStatusNotCancelled(any())).thenReturn(new ArrayList<>());
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(any())).thenReturn(List.of());

        NextAvailableSlotDTO slot = bookingService.findNextAvailableSlot(60, AFTER, null, null, null);

        assertThat(slot).isNotNull();
        assertThat(slot.date()).isEqualTo(FUTURE);
        assertThat(slot.slotStart()).isEqualTo(LocalTime.of(9, 0));
        assertThat(slot.slotEnd()).isEqualTo(LocalTime.of(10, 0));
    }

    @Test
    @DisplayName("Finder: a 09:00–10:00 booking pushes the first slot to 10:00 (control)")
    void finder_booking0910_pushesTo10() {
        stubOpenDayNoClosures();
        Booking booking = bookingBetween(9, 10); // build the mock BEFORE stubbing the repo (no nested stubbing)
        when(bookingRepository.findByDateAndStatusNotCancelled(any()))
                .thenReturn(new ArrayList<>(List.of(booking)));
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(any())).thenReturn(List.of());

        NextAvailableSlotDTO slot = bookingService.findNextAvailableSlot(60, AFTER, null, null, null);

        assertThat(slot).isNotNull();
        assertThat(slot.slotStart()).isEqualTo(LocalTime.of(10, 0));
    }

    // ====================== THE FIX: PA now blocks exactly like a booking ======================

    @Test
    @DisplayName("Finder: a 09:00–10:00 personal appointment pushes the first slot to 10:00 (same as a booking)")
    void finder_pa0910_pushesTo10_parityWithBooking() {
        stubOpenDayNoClosures();
        when(bookingRepository.findByDateAndStatusNotCancelled(any())).thenReturn(new ArrayList<>());
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(any()))
                .thenReturn(List.of(paBetween(LocalTime.of(9, 0), 60))); // 09:00–10:00

        NextAvailableSlotDTO slot = bookingService.findNextAvailableSlot(60, AFTER, null, null, null);

        // Identical outcome to finder_booking0910_pushesTo10 → PA occupancy == booking occupancy.
        assertThat(slot).isNotNull();
        assertThat(slot.slotStart()).isEqualTo(LocalTime.of(10, 0));
    }

    // ====================== extend-past-hours window (§0.2) still respected ======================

    @Test
    @DisplayName("Finder: with the salon fully booked, an extended window (→13:00) offers the 12:00 slot (control)")
    void finder_extendedWindow_offersExtendedSlot_whenNoPA() {
        stubOpenDayNoClosures();
        // 09:00–12:00 fully booked → the only free time is the 12:00–13:00 the window extends into.
        Booking booking = bookingBetween(9, 12); // build the mock BEFORE stubbing the repo (no nested stubbing)
        when(bookingRepository.findByDateAndStatusNotCancelled(any()))
                .thenReturn(new ArrayList<>(List.of(booking)));
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(any())).thenReturn(List.of());

        NextAvailableSlotDTO slot =
                bookingService.findNextAvailableSlot(60, AFTER, null, null, LocalTime.of(13, 0));

        assertThat(slot).isNotNull();
        assertThat(slot.slotStart()).isEqualTo(LocalTime.of(12, 0));
        assertThat(slot.slotEnd()).isEqualTo(LocalTime.of(13, 0));
    }

    @Test
    @DisplayName("Finder: a PA at 12:00–13:00 blocks the extended-window slot → no slot on day 0")
    void finder_extendedWindow_paBlocksExtendedSlot() {
        stubOpenDayNoClosures();
        Booking booking = bookingBetween(9, 12); // build the mock BEFORE stubbing the repo (no nested stubbing)
        when(bookingRepository.findByDateAndStatusNotCancelled(any()))
                .thenReturn(new ArrayList<>(List.of(booking)));
        // PA sits outside working hours (12:00–13:00) but inside the extended window → must block.
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(any()))
                .thenReturn(List.of(paBetween(LocalTime.of(12, 0), 60)));

        NextAvailableSlotDTO slot =
                bookingService.findNextAvailableSlot(60, AFTER, null, null, LocalTime.of(13, 0));

        // Whole normal range booked + extended slot blocked by the PA; maxAdvanceDays==1 → nothing.
        assertThat(slot).isNull();
    }

    // ====================== allowedDays is orthogonal to the PA fix (sanity) ======================

    @Test
    @DisplayName("Finder: allowedDays excluding the only scanned day → no slot (unaffected by PA merge)")
    void finder_allowedDaysExcludesDay_returnsNull() {
        // No repo stubs: the day is filtered out before any occupancy fetch (strict-stubs safe).
        Set<DayOfWeek> onlyOtherDay = Set.of(FUTURE.getDayOfWeek().plus(1));

        NextAvailableSlotDTO slot =
                bookingService.findNextAvailableSlot(60, AFTER, onlyOtherDay, null, null);

        assertThat(slot).isNull();
    }
}
