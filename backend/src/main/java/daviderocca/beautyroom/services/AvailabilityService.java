package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.availabilityDTOs.AvailabilityResponseDTO;
import daviderocca.beautyroom.DTO.availabilityDTOs.AvailabilitySlotDTO;
import daviderocca.beautyroom.DTO.availabilityDTOs.DayTimelineDTO;
import daviderocca.beautyroom.DTO.availabilityDTOs.PublicNextSlotDTO;
import daviderocca.beautyroom.DTO.availabilityDTOs.TimelineClosureDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Closure;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.WorkingHours;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ClosureRepository;
import daviderocca.beautyroom.repositories.WorkingHoursRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AvailabilityService {

    private final WorkingHoursRepository workingHoursRepository;
    private final ClosureRepository closureRepository;
    private final BookingRepository bookingRepository;
    private final ServiceItemService serviceItemService;
    private final PersonalAppointmentRepository personalAppointmentRepository;

    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Europe/Rome");

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    /**
     * Fixed candidate-start grid (minutes) for COMBINED multi-service availability.
     * NOT the combined duration: the salon's service durations are all multiples of
     * 10, so a 10-minute grid hides no valid start and creates no artificial gap,
     * while surfacing at least as many starts as the single-service step==duration
     * grid (so the cart is never MORE restrictive than "Prenota ora"). Tunable here.
     */
    private static final int SLOT_STEP_MINUTES = 10;

    @Value("${app.booking.max-advance-days:150}")
    private int maxAdvanceDays;

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
        serviceItemService.assertServiceActive(service);
        int durationMin = service.getDurationMin();
        if (durationMin <= 0) throw new BadRequestException("Durata servizio non valida.");

        WorkingHours wh = workingHoursRepository.findByDayOfWeek(date.getDayOfWeek())
                .orElseThrow(() -> new BadRequestException(
                        "Orari non configurati per " + date.getDayOfWeek()));

        if (wh.isClosed()) {
            return new AvailabilityResponseDTO(serviceId, date, durationMin, List.of());
        }

        List<TimeRange> openRanges = buildOpenRanges(wh, closureRepository.findOverlappingDate(date));
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

        // Generate all slots and mark each available/unavailable.
        // step == duration keeps the single-service grid byte-identical to before.
        List<AvailabilitySlotDTO> slots = generateAllSlots(openRanges, durationMin, durationMin, blockedIntervals, date);

        return new AvailabilityResponseDTO(serviceId, date, durationMin, slots);
    }

    // ==========================================================================
    // 1b) CLIENT AVAILABILITY — combined (multi-service) slots for a total duration
    // ==========================================================================

    /**
     * Combined availability for the public multi-service (cart) flow. Returns the
     * SAME shape as {@link #getServiceAvailabilities}: ALL candidate slots, each
     * flagged available=true/false, and an EMPTY list ONLY when the day is truly
     * closed or has no open ranges. An open-but-fully-booked day returns a NON-empty
     * list of slots all flagged available=false — so the calendar never mistakes
     * "full" for "closed" (the bug this fix targets).
     *
     * Differences from the single-service method, by design:
     *  - duration is the caller-supplied combined total (sum of service durations);
     *  - candidate starts sit on a fixed {@link #SLOT_STEP_MINUTES}-minute grid, not
     *    the duration, so the cart surfaces at least as many starts and is never MORE
     *    restrictive than "Prenota ora"; the whole block must still fit one open range;
     *  - personal appointments block too — identical to the /available-slots endpoint
     *    this replaces, so a customer can never book over Michela's personal time.
     */
    @Transactional(readOnly = true)
    public AvailabilityResponseDTO getCombinedAvailabilities(LocalDate date, int durationMinutes) {
        log.info("CombinedAvailability | date={} durationMinutes={}", date, durationMinutes);

        if (date == null) throw new BadRequestException("date obbligatoria.");
        if (date.isBefore(LocalDate.now(BUSINESS_ZONE)))
            throw new BadRequestException("Non è possibile richiedere disponibilità per date passate.");
        if (durationMinutes < 1) throw new BadRequestException("Durata non valida.");

        WorkingHours wh = workingHoursRepository.findByDayOfWeek(date.getDayOfWeek())
                .orElseThrow(() -> new BadRequestException(
                        "Orari non configurati per " + date.getDayOfWeek()));

        if (wh.isClosed()) {
            return new AvailabilityResponseDTO(null, date, SLOT_STEP_MINUTES, List.of());
        }

        List<TimeRange> openRanges = buildOpenRanges(wh, closureRepository.findOverlappingDate(date));
        if (openRanges.isEmpty()) {
            return new AvailabilityResponseDTO(null, date, SLOT_STEP_MINUTES, List.of());
        }

        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to   = date.plusDays(1).atStartOfDay();

        // Same blockers as the /available-slots endpoint this replaces: client bookings
        // (with admin padding) + Michela's personal appointments.
        List<Booking> blockingBookings = bookingRepository
                .findBookingsByStatusesIntersectingRange(from, to, BLOCKING_STATUSES);
        List<TimeRange> blockedIntervals = new ArrayList<>(toEffectiveBlockedIntervals(blockingBookings, date));
        personalAppointmentRepository.findByAppointmentDateOrderByStartTime(date)
                .forEach(pa -> {
                    LocalTime paEnd = pa.getStartTime().plusMinutes(pa.getDurationMinutes());
                    if (pa.getStartTime().isBefore(paEnd)) {
                        blockedIntervals.add(new TimeRange(pa.getStartTime(), paEnd));
                    }
                });

        List<AvailabilitySlotDTO> slots =
                generateAllSlots(openRanges, durationMinutes, SLOT_STEP_MINUTES, blockedIntervals, date);

        return new AvailabilityResponseDTO(null, date, SLOT_STEP_MINUTES, slots);
    }

    // ==========================================================================
    // 2) PUBLIC — next available slot for a service
    // ==========================================================================

    /**
     * Cerca il primo slot disponibile per il servizio a partire da fromDate.
     * Itera giorno per giorno per un massimo di 60 giorni.
     * Riusa interamente getServiceAvailabilities per la logica di business.
     *
     * @param fromTime  HH:mm opzionale — se presente, nel giorno fromDate salta tutti
     *                  gli slot il cui startTime è <= fromTime, permettendo di trovare
     *                  lo slot successivo nella stessa giornata senza ricominciare dal mattino.
     *                  Ignorato per i giorni successivi a fromDate.
     */
    @Transactional(readOnly = true)
    public Optional<PublicNextSlotDTO> findNextAvailableSlotForService(UUID serviceId, LocalDate fromDate, String fromTime) {
        LocalDate start = (fromDate != null && !fromDate.isBefore(LocalDate.now(BUSINESS_ZONE)))
                ? fromDate
                : LocalDate.now(BUSINESS_ZONE);

        // Parsing fromTime — null se assente o malformato
        LocalTime afterTime = null;
        if (fromTime != null && fromTime.matches("\\d{2}:\\d{2}")) {
            afterTime = LocalTime.parse(fromTime, HHMM);
        }
        final LocalTime afterTimeFinal = afterTime;

        for (int i = 0; i < maxAdvanceDays; i++) {
            LocalDate day = start.plusDays(i);
            // Il filtro orario si applica solo al primo giorno
            final boolean applyTimeFilter = (i == 0 && afterTimeFinal != null);
            try {
                AvailabilityResponseDTO resp = getServiceAvailabilities(serviceId, day);
                Optional<AvailabilitySlotDTO> first = resp.slots().stream()
                        .filter(AvailabilitySlotDTO::available)
                        .filter(s -> !applyTimeFilter ||
                                LocalTime.parse(s.start(), HHMM).isAfter(afterTimeFinal))
                        .findFirst();
                if (first.isPresent()) {
                    return Optional.of(new PublicNextSlotDTO(day, first.get().start(), first.get().end()));
                }
            } catch (BadRequestException e) {
                // giorno chiuso o non configurato: prosegui
            }
        }
        return Optional.empty();
    }

    /**
     * Cerca il primo slot COMBINATO disponibile per una durata totale arbitraria
     * (somma delle durate dei servizi nel carrello), a partire da fromDate.
     * Mirror esatto di {@link #findNextAvailableSlotForService}: stesso ciclo in avanti
     * (start clampato a >= oggi), stesso filtro fromTime applicato solo al giorno 0,
     * stesso try/catch per saltare i giorni chiusi/non configurati — ma la chiamata
     * per-giorno è {@link #getCombinedAvailabilities(LocalDate, int)} così lo slot
     * candidato è dimensionato sul blocco combinato (end == start + durationMinutes),
     * non sulla durata del primo servizio.
     */
    @Transactional(readOnly = true)
    public Optional<PublicNextSlotDTO> findNextAvailableCombinedSlot(int durationMinutes, LocalDate fromDate, String fromTime) {
        LocalDate start = (fromDate != null && !fromDate.isBefore(LocalDate.now(BUSINESS_ZONE)))
                ? fromDate
                : LocalDate.now(BUSINESS_ZONE);

        // Parsing fromTime — null se assente o malformato
        LocalTime afterTime = null;
        if (fromTime != null && fromTime.matches("\\d{2}:\\d{2}")) {
            afterTime = LocalTime.parse(fromTime, HHMM);
        }
        final LocalTime afterTimeFinal = afterTime;

        for (int i = 0; i < maxAdvanceDays; i++) {
            LocalDate day = start.plusDays(i);
            // Il filtro orario si applica solo al primo giorno
            final boolean applyTimeFilter = (i == 0 && afterTimeFinal != null);
            try {
                AvailabilityResponseDTO resp = getCombinedAvailabilities(day, durationMinutes);
                Optional<AvailabilitySlotDTO> first = resp.slots().stream()
                        .filter(AvailabilitySlotDTO::available)
                        .filter(s -> !applyTimeFilter ||
                                LocalTime.parse(s.start(), HHMM).isAfter(afterTimeFinal))
                        .findFirst();
                if (first.isPresent()) {
                    return Optional.of(new PublicNextSlotDTO(day, first.get().start(), first.get().end()));
                }
            } catch (BadRequestException e) {
                // giorno chiuso o non configurato: prosegui
            }
        }
        return Optional.empty();
    }

    // ==========================================================================
    // 3) ADMIN DAY TIMELINE
    // ==========================================================================

    @Transactional(readOnly = true)
    public DayTimelineDTO getDayTimeline(LocalDate date) {
        log.info("TimelineDay | date={}", date);
        if (date == null) throw new BadRequestException("Data non valida.");

        WorkingHours wh = workingHoursRepository.findByDayOfWeek(date.getDayOfWeek())
                .orElseThrow(() -> new BadRequestException(
                        "Orari non configurati per " + date.getDayOfWeek()));

        List<Closure> closures = closureRepository.findOverlappingDate(date);

        List<TimeRange> baseRanges  = wh.isClosed() ? List.of() : buildBaseRanges(wh);
        List<TimeRange> openRanges  = applyClosures(baseRanges, closures);
        List<TimelineClosureDTO> closureDTOs = closuresToTimelineDTO(closures);

        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to   = date.plusDays(1).atStartOfDay();

        List<Booking> bookings = bookingRepository.findBookingsByStatusesIntersectingRange(from, to, BLOCKING_STATUSES);
        List<TimeRange> bookingRanges = bookingsToRanges(bookings, date);

        return new DayTimelineDTO(
                date,
                toDTO(openRanges),
                closureDTOs,
                toDTO(bookingRanges)
        );
    }

    // ==========================================================================
    // 4) PUBLIC — available start times for a given duration (admin + public)
    // ==========================================================================

    /**
     * Returns all available slot start times (HH:mm) for a given date and duration.
     * Slots are generated every 30 minutes within working hours.
     * Both existing bookings (with padding) and personal appointments block slots.
     *
     * Used by:
     *   - GET /admin/bookings/available-slots (admin, ROLE_ADMIN)
     *   - GET /availabilities/available-slots (public, no auth)
     */
    @Transactional(readOnly = true)
    public List<String> getAvailableSlots(LocalDate date, int durationMinutes) {
        return getAvailableSlots(date, durationMinutes, null);
    }

    @Transactional(readOnly = true)
    public List<String> getAvailableSlots(LocalDate date, int durationMinutes, UUID excludeBookingId) {
        if (date == null) throw new BadRequestException("Data obbligatoria.");
        if (durationMinutes < 1) throw new BadRequestException("Durata non valida.");

        WorkingHours wh = workingHoursRepository.findByDayOfWeek(date.getDayOfWeek())
                .orElse(null);
        if (wh == null || wh.isClosed()) return List.of();

        List<TimeRange> openRanges = buildOpenRanges(wh, closureRepository.findOverlappingDate(date));
        if (openRanges.isEmpty()) return List.of();

        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to   = date.plusDays(1).atStartOfDay();

        // Blocked by existing client bookings (exclude the booking being edited so its own slot is free)
        List<Booking> bookings = bookingRepository.findBookingsByStatusesIntersectingRange(from, to, BLOCKING_STATUSES);
        if (excludeBookingId != null) {
            bookings = bookings.stream()
                    .filter(b -> !excludeBookingId.equals(b.getBookingId()))
                    .toList();
        }
        List<TimeRange> blocked = new ArrayList<>(toEffectiveBlockedIntervals(bookings, date));

        // Blocked by Michela's personal appointments
        personalAppointmentRepository.findByAppointmentDateOrderByStartTime(date)
                .forEach(pa -> {
                    LocalTime paEnd = pa.getStartTime().plusMinutes(pa.getDurationMinutes());
                    if (pa.getStartTime().isBefore(paEnd)) {
                        blocked.add(new TimeRange(pa.getStartTime(), paEnd));
                    }
                });

        // Generate slots every 30 minutes, return only available start times
        int stepMinutes = 30;
        List<String> available = new ArrayList<>();

        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalTime earliestStart = date.equals(today)
                ? LocalTime.now(BUSINESS_ZONE).plusMinutes(30)
                : LocalTime.MIN;

        for (TimeRange window : openRanges) {
            LocalTime cursor = window.start();
            while (true) {
                LocalTime slotEnd = cursor.plusMinutes(durationMinutes);
                if (slotEnd.isAfter(window.end())) break;

                if (cursor.isBefore(earliestStart)) {
                    cursor = cursor.plusMinutes(stepMinutes);
                    continue;
                }

                TimeRange slot = new TimeRange(cursor, slotEnd);
                boolean free = blocked.stream().noneMatch(b -> b.overlaps(slot));
                if (free) {
                    available.add(cursor.format(HHMM));
                }
                cursor = cursor.plusMinutes(stepMinutes);
            }
        }

        return available;
    }

    // ==========================================================================
    // PRIVATE — slot generation
    // ==========================================================================

    /**
     * Generates ALL slots that fit inside openRanges. Each slot is {@code durationMin}
     * wide and individually checked for overlap against blockedIntervals; candidate
     * start times advance by {@code stepMin}. Single-service callers pass
     * {@code stepMin == durationMin} (non-overlapping blocks — output byte-identical to
     * before); the combined multi-service caller passes a finer fixed grid
     * ({@link #SLOT_STEP_MINUTES}) while still requiring the full block to fit a range.
     *
     * This replaces the old "subtract bookings → generate free slots → append raw
     * booking ranges" approach, which produced slots of inconsistent width and
     * misleading occupied markers.
     */
    private List<AvailabilitySlotDTO> generateAllSlots(
            List<TimeRange> openRanges,
            int durationMin,
            int stepMin,
            List<TimeRange> blockedIntervals,
            LocalDate requestedDate) {

        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalTime earliestStart = requestedDate.equals(today)
                ? LocalTime.now(BUSINESS_ZONE).plusMinutes(30)
                : LocalTime.MIN;

        List<AvailabilitySlotDTO> result = new ArrayList<>();

        for (TimeRange window : openRanges) {
            LocalTime cursor = window.start();
            while (true) {
                LocalTime slotEnd = cursor.plusMinutes(durationMin);
                if (slotEnd.isAfter(window.end())) break;

                if (cursor.isBefore(earliestStart)) {
                    cursor = cursor.plusMinutes(stepMin);
                    continue;
                }

                TimeRange slot = new TimeRange(cursor, slotEnd);
                boolean occupied = blockedIntervals.stream().anyMatch(b -> b.overlaps(slot));

                result.add(new AvailabilitySlotDTO(
                        cursor.format(HHMM),
                        slotEnd.format(HHMM),
                        !occupied
                ));

                cursor = cursor.plusMinutes(stepMin); // step grid (== duration for single-service)
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

    /**
     * Builds enriched timeline closure DTOs from the closures covering the day —
     * keeps id + reason + fullDay so the agenda can render, label, and edit each
     * block. Unlike {@link #closuresToRanges} this does NOT merge adjacent ranges:
     * each closure must stay distinct on the timeline.
     */
    private List<TimelineClosureDTO> closuresToTimelineDTO(List<Closure> closures) {
        if (closures == null || closures.isEmpty()) return List.of();
        List<TimelineClosureDTO> out = new ArrayList<>();
        for (Closure c : closures) {
            if (c.isFullDay()) {
                out.add(new TimelineClosureDTO(
                        c.getId(),
                        LocalTime.MIN.format(HHMM),
                        LocalTime.of(23, 59).format(HHMM),
                        true,
                        c.getReason()
                ));
            } else if (c.getStartTime() != null && c.getEndTime() != null
                    && c.getStartTime().isBefore(c.getEndTime())) {
                out.add(new TimelineClosureDTO(
                        c.getId(),
                        c.getStartTime().format(HHMM),
                        c.getEndTime().format(HHMM),
                        false,
                        c.getReason()
                ));
            }
        }
        return out;
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
        // Do NOT merge: each booking must remain a separate range for timeline rendering.
        // Adjacent bookings (e.g. 09:00–10:00 and 10:00–10:45) must render as distinct blocks.
        return out.stream().sorted(Comparator.comparing(TimeRange::start)).toList();
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
        if (date.isBefore(LocalDate.now(BUSINESS_ZONE)))
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