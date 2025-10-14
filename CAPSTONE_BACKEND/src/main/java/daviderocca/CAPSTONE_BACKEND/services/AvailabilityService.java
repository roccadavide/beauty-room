package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs.AvailabilityResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs.AvailabilitySlotDTO;
import daviderocca.CAPSTONE_BACKEND.entities.*;
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
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class AvailabilityService {

    private final WorkingHoursRepository workingHoursRepository;

    private final ClosureRepository closureRepository;

    private final BookingRepository bookingRepository;

    private final ServiceItemService serviceItemService;

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    // ---------------------------------- MAIN METHOD ----------------------------------

    @Transactional(readOnly = true)
    public AvailabilityResponseDTO getServiceAvailabilities(UUID serviceId, LocalDate date) {
        log.info("▶️ Calcolo disponibilità per servizio {} nella data {}", serviceId, date);

        if (serviceId == null || date == null) {
            throw new BadRequestException("serviceId e data non possono essere null.");
        }
        if (date.isBefore(LocalDate.now())) {
            throw new BadRequestException("Non è possibile richiedere disponibilità per date passate.");
        }

        ServiceItem service = serviceItemService.findServiceItemById(serviceId);
        int durationMin = service.getDurationMin();
        int stepMin = durationMin;

        DayOfWeek dayOfWeek = date.getDayOfWeek();
        WorkingHours workingHours = workingHoursRepository.findByDayOfWeek(dayOfWeek)
                .orElseThrow(() -> new BadRequestException("Orari non configurati per " + dayOfWeek));

        if (workingHours.isClosed()) {
            log.info("Giorno {} chiuso per impostazione orari.", dayOfWeek);
            return new AvailabilityResponseDTO(serviceId, date, stepMin, List.of());
        }

        // intervalli base
        List<TimeRange> base = new ArrayList<>();
        if (workingHours.getMorningStart() != null && workingHours.getMorningEnd() != null
                && workingHours.getMorningStart().isBefore(workingHours.getMorningEnd())) {
            base.add(new TimeRange(workingHours.getMorningStart(), workingHours.getMorningEnd()));
        }
        if (workingHours.getAfternoonStart() != null && workingHours.getAfternoonEnd() != null
                && workingHours.getAfternoonStart().isBefore(workingHours.getAfternoonEnd())) {
            base.add(new TimeRange(workingHours.getAfternoonStart(), workingHours.getAfternoonEnd()));
        }
        if (base.isEmpty()) {
            log.info("Nessun intervallo orario valido per {}", dayOfWeek);
            return new AvailabilityResponseDTO(serviceId, date, stepMin, List.of());
        }

        // chiusure
        List<Closure> closures = closureRepository.findByDate(date);
        List<TimeRange> openRanges = applyClosures(base, closures);
        if (openRanges.isEmpty()) {
            log.info("Tutto il giorno {} risulta chiuso per chiusure parziali o totali.", date);
            return new AvailabilityResponseDTO(serviceId, date, stepMin, List.of());
        }

        // prenotazioni già esistenti
        LocalDateTime from = LocalDateTime.of(date, LocalTime.MIN);
        LocalDateTime to = LocalDateTime.of(date, LocalTime.MAX);
        List<Booking> bookings = bookingRepository.findByStartTimeLessThanAndEndTimeGreaterThan(to, from);
        List<TimeRange> free = subtractBookings(openRanges, bookings, date);

        // genera slot liberi
        List<AvailabilitySlotDTO> slots = generateSlots(free, durationMin, stepMin).stream()
                .map(r -> new AvailabilitySlotDTO(r.start().format(HHMM), r.end().format(HHMM)))
                .toList();

        log.info("Disponibilità trovate per servizio {} nella data {}: {} slot", serviceId, date, slots.size());
        return new AvailabilityResponseDTO(serviceId, date, stepMin, slots);
    }

    // ---------------------------------- HELPERS ----------------------------------

    private List<TimeRange> applyClosures(List<TimeRange> base, List<Closure> closures) {
        if (closures.stream().anyMatch(Closure::isFullDay)) return List.of();
        List<TimeRange> result = new ArrayList<>(base);
        for (Closure c : closures) {
            if (c.getStartTime() != null && c.getEndTime() != null && c.getStartTime().isBefore(c.getEndTime())) {
                result = subtractRange(result, new TimeRange(c.getStartTime(), c.getEndTime()));
            }
        }
        return result;
    }

    private List<TimeRange> subtractBookings(List<TimeRange> open, List<Booking> bookings, LocalDate date) {
        List<TimeRange> result = new ArrayList<>(open);
        for (Booking b : bookings) {
            if (!b.getStartTime().toLocalDate().equals(date)) continue;
            result = subtractRange(result, new TimeRange(b.getStartTime().toLocalTime(), b.getEndTime().toLocalTime()));
        }
        return result;
    }

    private List<TimeRange> subtractRange(List<TimeRange> src, TimeRange sub) {
        List<TimeRange> out = new ArrayList<>();
        for (TimeRange r : src) {
            if (!r.overlaps(sub)) out.add(r);
            else out.addAll(r.minus(sub));
        }
        return mergeAdjacent(out);
    }

    private List<TimeRange> mergeAdjacent(List<TimeRange> ranges) {
        if (ranges.isEmpty()) return ranges;
        List<TimeRange> sorted = ranges.stream()
                .sorted(Comparator.comparing(TimeRange::start))
                .collect(Collectors.toList());
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

    private LocalTime max(LocalTime a, LocalTime b) {
        return a.isAfter(b) ? a : b;
    }

    private record TimeRange(LocalTime start, LocalTime end) {
        boolean overlaps(TimeRange other) {
            return start.isBefore(other.end) && other.start.isBefore(end);
        }

        List<TimeRange> minus(TimeRange sub) {
            List<TimeRange> parts = new ArrayList<>();
            if (sub.start.isAfter(start) && sub.start.isBefore(end)) {
                parts.add(new TimeRange(start, sub.start));
            }
            if (sub.end.isAfter(start) && sub.end.isBefore(end)) {
                parts.add(new TimeRange(sub.end, end));
            }
            if (sub.start.compareTo(start) <= 0 && sub.end.compareTo(end) >= 0) {
                return List.of();
            }
            if (!overlaps(sub)) {
                return List.of(this);
            }
            return parts;
        }
    }
}