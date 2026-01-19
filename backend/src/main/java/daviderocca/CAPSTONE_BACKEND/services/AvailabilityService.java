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

    private static final List<BookingStatus> BLOCKING_STATUSES =
            List.of(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED);

    // =========================
    // 1) DISPONIBILITÀ CLIENTE (per servizio)
    // =========================
    @Transactional(readOnly = true)
    public AvailabilityResponseDTO getServiceAvailabilities(UUID serviceId, LocalDate date) {
        log.info("Availability | serviceId={} date={}", serviceId, date);

        if (serviceId == null) throw new BadRequestException("serviceId obbligatorio.");
        if (date == null) throw new BadRequestException("date obbligatoria.");
        if (date.isBefore(LocalDate.now())) throw new BadRequestException("Non è possibile richiedere disponibilità per date passate.");

        ServiceItem service = serviceItemService.findServiceItemById(serviceId);
        int durationMin = service.getDurationMin();
        if (durationMin <= 0) throw new BadRequestException("Durata servizio non valida.");

        // Scelta: step = durata (slot “a blocchi”). Se vuoi più granularità un domani: es. min(durata, 30)
        int stepMin = durationMin;

        WorkingHours wh = workingHoursRepository.findByDayOfWeek(date.getDayOfWeek())
                .orElseThrow(() -> new BadRequestException("Orari non configurati per " + date.getDayOfWeek()));

        if (wh.isClosed()) {
            return new AvailabilityResponseDTO(serviceId, date, stepMin, List.of());
        }

        List<TimeRange> baseRanges = buildBaseRanges(wh);
        if (baseRanges.isEmpty()) {
            return new AvailabilityResponseDTO(serviceId, date, stepMin, List.of());
        }

        List<Closure> closures = closureRepository.findByDate(date);

        // open ranges = orari di lavoro - chiusure
        List<TimeRange> openRanges = applyClosures(baseRanges, closures);
        if (openRanges.isEmpty()) {
            return new AvailabilityResponseDTO(serviceId, date, stepMin, List.of());
        }

        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to = date.plusDays(1).atStartOfDay(); // exclusive

        // prenotazioni che bloccano (PENDING/CONFIRMED)
        List<Booking> bookings = bookingRepository.findBookingsByStatusesIntersectingRange(from, to, BLOCKING_STATUSES);

        List<TimeRange> free = subtractBookings(openRanges, bookings, date);

        List<AvailabilitySlotDTO> slots = generateSlots(free, durationMin, stepMin).stream()
                .map(r -> new AvailabilitySlotDTO(r.start().format(HHMM), r.end().format(HHMM)))
                .toList();

        return new AvailabilityResponseDTO(serviceId, date, stepMin, slots);
    }

    // =========================
    // 2) TIMELINE DAY ADMIN (GESTIONALE)
    // =========================
    @Transactional(readOnly = true)
    public DayTimelineDTO getDayTimeline(LocalDate date) {
        log.info("TimelineDay | date={}", date);

        if (date == null) throw new BadRequestException("Data non valida.");

        WorkingHours wh = workingHoursRepository.findByDayOfWeek(date.getDayOfWeek())
                .orElseThrow(() -> new BadRequestException("Orari non configurati per " + date.getDayOfWeek()));

        List<Closure> closures = closureRepository.findByDate(date);

        // openRanges: se closed => vuoto
        List<TimeRange> baseRanges = wh.isClosed() ? List.of() : buildBaseRanges(wh);
        List<TimeRange> openRanges = applyClosures(baseRanges, closures);

        // closureRanges: solo “visivo”
        List<TimeRange> closureRanges = closuresToRanges(closures);

        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to = date.plusDays(1).atStartOfDay();

        List<Booking> bookings = bookingRepository.findBookingsByStatusesIntersectingRange(from, to, BLOCKING_STATUSES);
        List<TimeRange> bookingRanges = bookingsToRanges(bookings, date);

        return new DayTimelineDTO(
                date,
                toDTO(openRanges),
                toDTO(closureRanges),
                toDTO(bookingRanges)
        );
    }

    // =========================
    // HELPERS
    // =========================

    private List<TimeRange> buildBaseRanges(WorkingHours wh) {
        List<TimeRange> base = new ArrayList<>();

        if (wh.getMorningStart() != null && wh.getMorningEnd() != null && wh.getMorningStart().isBefore(wh.getMorningEnd())) {
            base.add(new TimeRange(wh.getMorningStart(), wh.getMorningEnd()));
        }
        if (wh.getAfternoonStart() != null && wh.getAfternoonEnd() != null && wh.getAfternoonStart().isBefore(wh.getAfternoonEnd())) {
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
                if (c.getStartTime() != null && c.getEndTime() != null && c.getStartTime().isBefore(c.getEndTime())) {
                    result = subtractRange(result, new TimeRange(c.getStartTime(), c.getEndTime()));
                }
            }
        }

        return mergeAdjacent(result);
    }

    private List<TimeRange> closuresToRanges(List<Closure> closures) {
        if (closures == null || closures.isEmpty()) return List.of();

        // Timeline: visivo. Full-day lo mostro “tutto il giorno”.
        // NOTA: non deve influenzare i calcoli di disponibilità (lì usiamo applyClosures).
        List<TimeRange> out = new ArrayList<>();
        for (Closure c : closures) {
            if (c.isFullDay()) {
                // internamente uso LocalTime.MAX, ma formato HH:mm => "23:59"
                out.add(new TimeRange(LocalTime.MIN, LocalTime.MAX));
            } else if (c.getStartTime() != null && c.getEndTime() != null && c.getStartTime().isBefore(c.getEndTime())) {
                out.add(new TimeRange(c.getStartTime(), c.getEndTime()));
            }
        }
        return mergeAdjacent(out);
    }

    private List<TimeRange> bookingsToRanges(List<Booking> bookings, LocalDate date) {
        if (bookings == null || bookings.isEmpty()) return List.of();

        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

        List<TimeRange> out = new ArrayList<>();
        for (Booking b : bookings) {
            LocalDateTime bs = b.getStartTime();
            LocalDateTime be = b.getEndTime();

            LocalDateTime clippedStart = bs.isBefore(dayStart) ? dayStart : bs;
            LocalDateTime clippedEnd = be.isAfter(dayEnd) ? dayEnd : be;
            if (!clippedStart.isBefore(clippedEnd)) continue;

            out.add(new TimeRange(clippedStart.toLocalTime(), clippedEnd.toLocalTime()));
        }
        return mergeAdjacent(out);
    }

    private List<TimeRange> subtractBookings(List<TimeRange> open, List<Booking> bookings, LocalDate date) {
        if (open == null || open.isEmpty()) return List.of();
        if (bookings == null || bookings.isEmpty()) return open;

        List<TimeRange> result = new ArrayList<>(open);
        for (TimeRange br : bookingsToRanges(bookings, date)) {
            result = subtractRange(result, br);
        }
        return mergeAdjacent(result);
    }

    private List<TimeRange> subtractRange(List<TimeRange> src, TimeRange sub) {
        if (src == null || src.isEmpty()) return List.of();

        List<TimeRange> out = new ArrayList<>();
        for (TimeRange r : src) {
            if (!r.overlaps(sub)) out.add(r);
            else out.addAll(r.minus(sub));
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
                cur = new TimeRange(cur.start(), max(cur.end(), nxt.end()));
            } else {
                out.add(cur);
                cur = nxt;
            }
        }
        out.add(cur);
        return out;
    }

    private List<TimeRange> generateSlots(List<TimeRange> free, int durationMin, int stepMin) {
        if (free == null || free.isEmpty()) return List.of();
        if (durationMin <= 0) throw new BadRequestException("Durata servizio non valida.");
        if (stepMin <= 0) stepMin = durationMin;

        List<TimeRange> slots = new ArrayList<>();
        for (TimeRange r : free) {
            LocalTime cursor = r.start();
            while (!cursor.plusMinutes(durationMin).isAfter(r.end())) {
                slots.add(new TimeRange(cursor, cursor.plusMinutes(durationMin)));
                cursor = cursor.plusMinutes(stepMin);
            }
        }
        return slots;
    }

    private List<AvailabilitySlotDTO> toDTO(List<TimeRange> ranges) {
        if (ranges == null || ranges.isEmpty()) return List.of();
        return ranges.stream()
                .map(r -> new AvailabilitySlotDTO(r.start().format(HHMM), r.end().format(HHMM)))
                .toList();
    }

    private LocalTime max(LocalTime a, LocalTime b) {
        return a.isAfter(b) ? a : b;
    }

    private record TimeRange(LocalTime start, LocalTime end) {
        boolean overlaps(TimeRange other) {
            return start.isBefore(other.end) && other.start.isBefore(end);
        }

        List<TimeRange> minus(TimeRange sub) {
            if (!overlaps(sub)) return List.of(this);
            if (sub.start.compareTo(start) <= 0 && sub.end.compareTo(end) >= 0) return List.of();

            List<TimeRange> parts = new ArrayList<>();
            if (sub.start.isAfter(start)) parts.add(new TimeRange(start, sub.start));
            if (sub.end.isBefore(end)) parts.add(new TimeRange(sub.end, end));
            return parts;
        }
    }
}