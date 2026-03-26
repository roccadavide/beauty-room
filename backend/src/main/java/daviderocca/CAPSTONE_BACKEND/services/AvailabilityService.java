package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs.AvailabilityResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs.AvailabilitySlotDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs.DayTimelineDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.Closure;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.WorkingHours;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.ClosureRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.WorkingHoursRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class AvailabilityService {

    private final WorkingHoursRepository workingHoursRepository;
    private final ClosureRepository closureRepository;
    private final BookingRepository bookingRepository;
    private final ServiceItemService serviceItemService;

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    /**
     * Statuses that physically occupy a slot and prevent new bookings.
     * PENDING_PAYMENT is included because while a user is in the Stripe checkout
     * flow the slot must remain reserved (short TTL handled by the expiry job).
     */
    private static final List<BookingStatus> BLOCKING_STATUSES =
            List.of(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED);

    // ==========================================================================
    // 1) CLIENT AVAILABILITY — all slots for a service on a given date
    // ==========================================================================

    /**
     * Returns ALL possible slots for the given service on the given date.
     * Each slot is marked available=true or available=false based on whether it
     * overlaps any existing blocking booking (including the booking's optional
     * paddingMinutes extra buffer set by the admin in the agenda).
     *
     * Design rationale:
     *  - Slot duration == service duration (single-operator model, no partial overlap).
     *  - Step == service duration (non-overlapping blocks, clearest UX for a beauty salon).
     *  - Overlap check is per-slot, not subtractive: this guarantees slots are always
     *    the same width in the UI and the blocked/free state is visually consistent.
     */
    @Transactional(readOnly = true)
    public AvailabilityResponseDTO getServiceAvailabilities(UUID serviceId, LocalDate date) {
        log.info("Availability | serviceId={} date={}", serviceId, date);

        validateInputs(serviceId, date);

        ServiceItem service = serviceItemService.findServiceItemById(serviceId);
        int durationMin = service.getDurationMin();
        if (durationMin <= 0) throw new BadRequestException("Durata servizio non valida.");

        WorkingHours wh = workingHoursRepository.findByDayOfWeek(date.getDayOfWeek())
                .orElseThrow(() -> new BadRequestException(
                        "Orari non configurati per " + date.getDayOfWeek()));

        if (wh.isClosed()) {
            return new AvailabilityResponseDTO(serviceId, date, durationMin, List.of());
        }

        List<TimeRange> openRanges = buildOpenRanges(wh, closureRepository.findByDate(date));
        if (openRanges.isEmpty()) {
            return new AvailabilityResponseDTO(serviceId, date, durationMin, List.of());
        }

        // Fetch blocking bookings for the day (inclusive of padding)
        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to   = date.plusDays(1).atStartOfDay();
        List<Booking> blockingBookings = bookingRepository
                .findBookingsByStatusesIntersectingRange(from, to, BLOCKING_STATUSES);

        // Pre-compute effective blocked intervals (booking range + optional paddingMinutes)
        List<TimeRange> blockedIntervals = toEffectiveBlockedIntervals(blockingBookings, date);

        // Generate all slots and mark each available/unavailable
        List<AvailabilitySlotDTO> slots = generateAllSlots(openRanges, durationMin, blockedIntervals);

        return new AvailabilityResponseDTO(serviceId, date, durationMin, slots);
    }

    // ==========================================================================
    // 2) ADMIN DAY TIMELINE
    // ==========================================================================

    @Transactional(readOnly = true)
    public DayTimelineDTO getDayTimeline(LocalDate date) {
        log.info("TimelineDay | date={}", date);
        if (date == null) throw new BadRequestException("Data non valida.");

        WorkingHours wh = workingHoursRepository.findByDayOfWeek(date.getDayOfWeek())
                .orElseThrow(() -> new BadRequestException(
                        "Orari non configurati per " + date.getDayOfWeek()));

        List<Closure> closures = closureRepository.findByDate(date);

        List<TimeRange> baseRanges  = wh.isClosed() ? List.of() : buildBaseRanges(wh);
        List<TimeRange> openRanges  = applyClosures(baseRanges, closures);
        List<TimeRange> closureRanges = closuresToRanges(closures);

        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to   = date.plusDays(1).atStartOfDay();

        List<Booking> bookings = bookingRepository.findBookingsByStatusesIntersectingRange(from, to, BLOCKING_STATUSES);
        List<TimeRange> bookingRanges = bookingsToRanges(bookings, date);

        return new DayTimelineDTO(
                date,
                toDTO(openRanges),
                toDTO(closureRanges),
                toDTO(bookingRanges)
        );
    }

    // ==========================================================================
    // PRIVATE — slot generation
    // ==========================================================================

    /**
     * Generates ALL slots that fit inside openRanges with the given duration.
     * Each slot is individually checked for overlap against blockedIntervals.
     *
     * This replaces the old "subtract bookings → generate free slots → append raw
     * booking ranges" approach, which produced slots of inconsistent width and
     * misleading occupied markers.
     */
    private List<AvailabilitySlotDTO> generateAllSlots(
            List<TimeRange> openRanges,
            int durationMin,
            List<TimeRange> blockedIntervals) {

        List<AvailabilitySlotDTO> result = new ArrayList<>();

        for (TimeRange window : openRanges) {
            LocalTime cursor = window.start();
            while (true) {
                LocalTime slotEnd = cursor.plusMinutes(durationMin);
                if (slotEnd.isAfter(window.end())) break;

                TimeRange slot = new TimeRange(cursor, slotEnd);
                boolean occupied = blockedIntervals.stream().anyMatch(b -> b.overlaps(slot));

                result.add(new AvailabilitySlotDTO(
                        cursor.format(HHMM),
                        slotEnd.format(HHMM),
                        !occupied
                ));

                cursor = cursor.plusMinutes(durationMin); // step == duration (single operator)
            }
        }

        return result;
    }

    /**
     * Converts blocking bookings to their *effective* time intervals.
     *
     * Effective end = booking.endTime + paddingMinutes (if set by admin).
     * paddingMinutes is an optional admin-only field that buffers time after a
     * session for cleanup, late clients, etc. It does NOT affect the endTime
     * stored in the DB — it only influences availability calculation.
     *
     * When the paddingMinutes field does not yet exist on the entity (pre-migration),
     * the fallback getPaddingMinutes() == null / 0 is safe — no NPE.
     */
    private List<TimeRange> toEffectiveBlockedIntervals(List<Booking> bookings, LocalDate date) {
        if (bookings == null || bookings.isEmpty()) return List.of();

        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd   = date.plusDays(1).atStartOfDay();

        List<TimeRange> result = new ArrayList<>();
        for (Booking b : bookings) {
            LocalDateTime start = b.getStartTime();
            LocalDateTime end   = b.getEndTime();
            if (start == null || end == null) continue;

            // Apply padding if present (Michela's extra-minutes feature)
            int padding = (b.getPaddingMinutes() != null && b.getPaddingMinutes() > 0)
                    ? b.getPaddingMinutes() : 0;
            LocalDateTime effectiveEnd = end.plusMinutes(padding);

            // Clip to day boundary (booking might span midnight in theory)
            LocalDateTime clippedStart = start.isBefore(dayStart) ? dayStart : start;
            LocalDateTime clippedEnd   = effectiveEnd.isAfter(dayEnd) ? dayEnd : effectiveEnd;
            if (!clippedStart.isBefore(clippedEnd)) continue;

            result.add(new TimeRange(clippedStart.toLocalTime(), clippedEnd.toLocalTime()));
        }
        return result;
    }

    // ==========================================================================
    // PRIVATE — working hours / closures
    // ==========================================================================

    private List<TimeRange> buildOpenRanges(WorkingHours wh, List<Closure> closures) {
        return applyClosures(buildBaseRanges(wh), closures);
    }

    private List<TimeRange> buildBaseRanges(WorkingHours wh) {
        List<TimeRange> base = new ArrayList<>();
        if (wh.getMorningStart() != null && wh.getMorningEnd() != null
                && wh.getMorningStart().isBefore(wh.getMorningEnd())) {
            base.add(new TimeRange(wh.getMorningStart(), wh.getMorningEnd()));
        }
        if (wh.getAfternoonStart() != null && wh.getAfternoonEnd() != null
                && wh.getAfternoonStart().isBefore(wh.getAfternoonEnd())) {
            base.add(new TimeRange(wh.getAfternoonStart(), wh.getAfternoonEnd()));
        }
        return base;
    }

    private List<TimeRange> applyClosures(List<TimeRange> base, List<Closure> closures) {
        if (base == null || base.isEmpty()) return List.of();
        if (closures != null && closures.stream().anyMatch(Closure::isFullDay)) return List.of();

        List<TimeRange> result = new ArrayList<>(base);
        if (closures != null) {
            for (Closure c : closures) {
                if (c.getStartTime() != null && c.getEndTime() != null
                        && c.getStartTime().isBefore(c.getEndTime())) {
                    result = subtractRange(result, new TimeRange(c.getStartTime(), c.getEndTime()));
                }
            }
        }
        return mergeAdjacent(result);
    }

    private List<TimeRange> closuresToRanges(List<Closure> closures) {
        if (closures == null || closures.isEmpty()) return List.of();
        List<TimeRange> out = new ArrayList<>();
        for (Closure c : closures) {
            if (c.isFullDay()) {
                out.add(new TimeRange(LocalTime.MIN, LocalTime.MAX));
            } else if (c.getStartTime() != null && c.getEndTime() != null
                    && c.getStartTime().isBefore(c.getEndTime())) {
                out.add(new TimeRange(c.getStartTime(), c.getEndTime()));
            }
        }
        return mergeAdjacent(out);
    }

    private List<TimeRange> bookingsToRanges(List<Booking> bookings, LocalDate date) {
        if (bookings == null || bookings.isEmpty()) return List.of();
        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd   = date.plusDays(1).atStartOfDay();
        List<TimeRange> out = new ArrayList<>();
        for (Booking b : bookings) {
            if (b.getStartTime() == null || b.getEndTime() == null) continue;
            LocalDateTime cs = b.getStartTime().isBefore(dayStart) ? dayStart : b.getStartTime();
            LocalDateTime ce = b.getEndTime().isAfter(dayEnd)   ? dayEnd   : b.getEndTime();
            if (!cs.isBefore(ce)) continue;
            out.add(new TimeRange(cs.toLocalTime(), ce.toLocalTime()));
        }
        return mergeAdjacent(out);
    }

    // ==========================================================================
    // PRIVATE — interval algebra
    // ==========================================================================

    private List<TimeRange> subtractRange(List<TimeRange> src, TimeRange sub) {
        if (src == null || src.isEmpty()) return List.of();
        List<TimeRange> out = new ArrayList<>();
        for (TimeRange r : src) {
            if (!r.overlaps(sub)) {
                out.add(r);
            } else {
                out.addAll(r.minus(sub));
            }
        }
        return out;
    }

    private List<TimeRange> mergeAdjacent(List<TimeRange> ranges) {
        if (ranges == null || ranges.isEmpty()) return List.of();
        List<TimeRange> sorted = ranges.stream()
                .sorted(Comparator.comparing(TimeRange::start))
                .toList();
        List<TimeRange> out = new ArrayList<>();
        TimeRange cur = sorted.get(0);
        for (int i = 1; i < sorted.size(); i++) {
            TimeRange nxt = sorted.get(i);
            if (!cur.end().isBefore(nxt.start())) {
                cur = new TimeRange(cur.start(), cur.end().isAfter(nxt.end()) ? cur.end() : nxt.end());
            } else {
                out.add(cur);
                cur = nxt;
            }
        }
        out.add(cur);
        return out;
    }

    // ==========================================================================
    // PRIVATE — DTO helpers
    // ==========================================================================

    private List<AvailabilitySlotDTO> toDTO(List<TimeRange> ranges) {
        if (ranges == null || ranges.isEmpty()) return List.of();
        return ranges.stream()
                .map(r -> new AvailabilitySlotDTO(r.start().format(HHMM), r.end().format(HHMM), true))
                .toList();
    }

    private void validateInputs(UUID serviceId, LocalDate date) {
        if (serviceId == null) throw new BadRequestException("serviceId obbligatorio.");
        if (date == null)      throw new BadRequestException("date obbligatoria.");
        if (date.isBefore(LocalDate.now()))
            throw new BadRequestException("Non è possibile richiedere disponibilità per date passate.");
    }

    // ==========================================================================
    // PRIVATE — TimeRange record
    // ==========================================================================

    private record TimeRange(LocalTime start, LocalTime end) {

        boolean overlaps(TimeRange other) {
            return start.isBefore(other.end) && other.start.isBefore(end);
        }

        List<TimeRange> minus(TimeRange sub) {
            if (!overlaps(sub)) return List.of(this);
            if (sub.start.compareTo(start) <= 0 && sub.end.compareTo(end) >= 0) return List.of();
            List<TimeRange> parts = new ArrayList<>();
            if (sub.start.isAfter(start)) parts.add(new TimeRange(start, sub.start));
            if (sub.end.isBefore(end))    parts.add(new TimeRange(sub.end, end));
            return parts;
        }
    }
}