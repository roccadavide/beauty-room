package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.closureDTOs.ClosureConflictPreviewDTO;
import daviderocca.beautyroom.DTO.closureDTOs.ClosureConflictPreviewDTO.ConflictBookingInfo;
import daviderocca.beautyroom.DTO.closureDTOs.ClosureResponseDTO;
import daviderocca.beautyroom.DTO.closureDTOs.NewClosureDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Closure;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ClosureRepository;
import daviderocca.beautyroom.scheduler.ClosureReminderScheduler;
import daviderocca.beautyroom.staff.StaffMember;
import daviderocca.beautyroom.staff.StaffMemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ClosureService {

    private static final List<BookingStatus> BLOCKING_STATUSES =
            List.of(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.COMPLETED);

    private final ClosureRepository closureRepository;
    private final BookingRepository bookingRepository;
    private final ClosureReminderScheduler closureReminderScheduler;
    // Multi-staff prompt 03 (decision #7): closures with staffId = per-staff absences.
    private final StaffMemberRepository staffMemberRepository;

    // -------------------------- FIND --------------------------
    @Transactional(readOnly = true)
    public List<ClosureResponseDTO> findAllClosures() {
        return closureRepository.findAll().stream()
                .map(this::convertToDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ClosureResponseDTO> findClosuresInRange(LocalDate from, LocalDate toExclusive) {
        if (from == null || toExclusive == null) throw new BadRequestException("Range non valido.");
        if (!from.isBefore(toExclusive)) throw new BadRequestException("Range non valido (from < to).");

        return closureRepository.findByDateRange(from, toExclusive).stream()
                .map(this::convertToDTO)
                .toList();
    }

    // -------------------------- CREATE --------------------------
    @Transactional
    public ClosureResponseDTO createClosure(NewClosureDTO payload) {
        validateClosure(payload, null, /*isUpdate*/ false);

        LocalDate startDate = payload.effectiveStartDate();
        LocalDate endDate   = payload.effectiveEndDate();

        Closure closure = new Closure(
                startDate,
                endDate,
                payload.startTime(),
                payload.endTime(),
                payload.reason() != null ? payload.reason().trim() : null
        );
        closure.setStaffMember(resolveStaffOrNull(payload.staffId()));

        Closure saved = closureRepository.save(closure);
        int bookingConflicts = countOverlappingBookings(saved);
        log.info("Nuova chiusura creata id={} [{} → {}] conflittiBooking={}",
                saved.getId(), saved.getStartDate(), saved.getEndDate(), bookingConflicts);

        // Safety net: closure starting today or tomorrow → fire reminder immediately.
        closureReminderScheduler.emitReminderForTomorrowIfApplicable(saved);

        return convertToDTO(saved);
    }

    // -------------------------- UPDATE --------------------------
    @Transactional
    public ClosureResponseDTO updateClosure(UUID id, NewClosureDTO payload) {
        Closure closure = closureRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Chiusura non trovata con id: " + id));

        validateClosure(payload, id, /*isUpdate*/ true);

        LocalDate startDate = payload.effectiveStartDate();
        LocalDate endDate   = payload.effectiveEndDate();

        closure.setStartDate(startDate);
        closure.setEndDate(endDate);
        closure.setDate(startDate); // keep legacy column in sync
        closure.setStartTime(payload.startTime());
        closure.setEndTime(payload.endTime());
        closure.setReason(payload.reason() != null ? payload.reason().trim() : null);
        closure.setStaffMember(resolveStaffOrNull(payload.staffId()));

        Closure updated = closureRepository.save(closure);
        log.info("Chiusura {} aggiornata [{} → {}]", updated.getId(), updated.getStartDate(), updated.getEndDate());

        closureReminderScheduler.emitReminderForTomorrowIfApplicable(updated);

        return convertToDTO(updated);
    }

    // -------------------------- DELETE --------------------------
    @Transactional
    public void deleteClosure(UUID id) {
        if (!closureRepository.existsById(id)) {
            throw new ResourceNotFoundException("Chiusura non trovata con id: " + id);
        }
        closureRepository.deleteById(id);
        log.info("Chiusura {} eliminata.", id);
    }

    // -------------------------- PREVIEW (conflict report) --------------------------

    /**
     * Returns the count and a light list of active bookings overlapping the proposed
     * closure range. Never throws on conflicts: this is informational only.
     */
    @Transactional(readOnly = true)
    public ClosureConflictPreviewDTO previewClosure(NewClosureDTO payload) {
        LocalDate startDate = payload.effectiveStartDate();
        LocalDate endDate   = payload.effectiveEndDate();
        if (startDate == null) return new ClosureConflictPreviewDTO(0, List.of());
        if (endDate == null || endDate.isBefore(startDate)) endDate = startDate;

        Closure probe = new Closure(startDate, endDate,
                payload.startTime(), payload.endTime(),
                payload.reason() != null ? payload.reason() : "preview");
        // staffId present -> preview only that staff's bookings (prompt 03).
        probe.setStaffMember(resolveStaffOrNull(payload.staffId()));
        return countOverlappingBookingsAsDTO(probe);
    }

    // -------------------------- BOOKING-SIDE HELPERS --------------------------

    /**
     * True iff any active closure covers any part of [bookingStart, bookingEnd).
     * Used by BookingService to reject pre-payment bookings that fall in a closure
     * and to flag webhook bookings as conflicting after the fact.
     */
    @Transactional(readOnly = true)
    public boolean hasOverlappingClosure(LocalDateTime bookingStart, LocalDateTime bookingEnd) {
        if (bookingStart == null || bookingEnd == null) return false;
        if (!bookingStart.isBefore(bookingEnd)) return false;

        LocalDate startDate = bookingStart.toLocalDate();
        LocalDate endDate   = bookingEnd.toLocalDate();

        LocalDate cursor = startDate;
        while (!cursor.isAfter(endDate)) {
            List<Closure> dayClosures = closureRepository.findOverlappingDate(cursor);
            for (Closure c : dayClosures) {
                if (c.isFullDay()) return true;
                LocalTime bs = cursor.equals(startDate) ? bookingStart.toLocalTime() : LocalTime.MIN;
                LocalTime be = cursor.equals(endDate)   ? bookingEnd.toLocalTime()   : LocalTime.MAX;
                if (bs.isBefore(c.getEndTime()) && c.getStartTime().isBefore(be)) {
                    return true;
                }
            }
            cursor = cursor.plusDays(1);
        }
        return false;
    }

    public void assertNoOverlappingClosure(LocalDateTime bookingStart, LocalDateTime bookingEnd) {
        if (hasOverlappingClosure(bookingStart, bookingEnd)) {
            throw new BadRequestException(
                    "Lo slot ricade in una chiusura programmata: prenotazione non consentita."
            );
        }
    }

    // -------------------------- VALIDATION --------------------------
    private void validateClosure(NewClosureDTO payload, UUID excludeId, boolean isUpdate) {
        if (payload == null) throw new BadRequestException("Payload mancante.");

        LocalDate startDate = payload.effectiveStartDate();
        LocalDate endDate   = payload.effectiveEndDate();
        if (startDate == null) throw new BadRequestException("La data di inizio è obbligatoria.");
        if (endDate == null) endDate = startDate;
        if (endDate.isBefore(startDate)) {
            throw new BadRequestException("La data finale deve essere uguale o successiva a quella di inizio.");
        }

        // "No past" only for NEW closures. Editing an existing closure that has
        // already started (e.g. extending the endDate or fixing the reason) is allowed.
        if (!isUpdate && endDate.isBefore(LocalDate.now())) {
            throw new BadRequestException("La data della chiusura non può essere nel passato.");
        }

        if (payload.reason() == null || payload.reason().trim().isEmpty()) {
            throw new BadRequestException("La motivazione della chiusura è obbligatoria.");
        }
        if (payload.reason().length() > 150) {
            throw new BadRequestException("La motivazione può essere lunga al massimo 150 caratteri.");
        }

        LocalTime start = payload.startTime();
        LocalTime end   = payload.endTime();
        boolean fullDay  = (start == null && end == null);
        boolean multiDay = endDate.isAfter(startDate);

        if (!fullDay) {
            if (start == null || end == null) {
                throw new BadRequestException("Per una chiusura parziale devi specificare sia inizio che fine fascia.");
            }
            if (!start.isBefore(end)) {
                throw new BadRequestException("L'orario di inizio deve essere precedente a quello di fine.");
            }
            if (multiDay) {
                throw new BadRequestException("Una chiusura su più giorni deve essere a giornata intera.");
            }
        }

        // Closure-vs-closure overlap detection across the entire range.
        // Self-overlap is excluded via excludeId so editing the same row never reports itself.
        // Staff scoping (prompt 03): two DIFFERENT staff members' absences may coexist on the
        // same day — only closures whose scope intersects the payload's conflict (salon-wide
        // closures, staffId NULL, intersect everything).
        UUID payloadStaffId = payload.staffId();
        LocalDate cursor = startDate;
        while (!cursor.isAfter(endDate)) {
            List<Closure> existing = (excludeId == null)
                    ? closureRepository.findOverlappingDate(cursor)
                    : closureRepository.findOverlappingDateExcluding(cursor, excludeId);

            for (Closure c : existing) {
                UUID existingStaffId = c.getStaffMember() != null ? c.getStaffMember().getId() : null;
                boolean scopesIntersect = payloadStaffId == null
                        || existingStaffId == null
                        || payloadStaffId.equals(existingStaffId);
                if (!scopesIntersect) continue;

                if (c.isFullDay() || fullDay) {
                    throw new BadRequestException(
                            "Sovrapposizione con chiusura esistente del " + cursor + " (" + c.getReason() + ").");
                }
                // both partial — must be same single day per multiDay guard above
                if (start.isBefore(c.getEndTime()) && c.getStartTime().isBefore(end)) {
                    throw new BadRequestException(
                            "La chiusura si sovrappone a un'altra del " + cursor +
                            " (" + c.getStartTime() + "-" + c.getEndTime() + ", " + c.getReason() + ").");
                }
            }
            cursor = cursor.plusDays(1);
        }
    }

    // -------------------------- BOOKING OVERLAP HELPERS (preview + log) --------------------------

    private int countOverlappingBookings(Closure c) {
        return countOverlappingBookingsAsDTO(c).overlappingBookingsCount();
    }

    private ClosureConflictPreviewDTO countOverlappingBookingsAsDTO(Closure c) {
        LocalDate startDate = c.getStartDate();
        LocalDate endDate   = c.getEndDate();
        if (startDate == null || endDate == null) {
            return new ClosureConflictPreviewDTO(0, List.of());
        }

        LocalDateTime rangeStart = c.isFullDay()
                ? startDate.atStartOfDay()
                : startDate.atTime(c.getStartTime());
        LocalDateTime rangeEnd = c.isFullDay()
                ? endDate.plusDays(1).atStartOfDay()
                : startDate.atTime(c.getEndTime());

        if (!rangeStart.isBefore(rangeEnd)) {
            return new ClosureConflictPreviewDTO(0, List.of());
        }

        // Staff absence (staffMember set) -> only that staff's bookings conflict (prompt 03);
        // salon-wide closure keeps today's behavior (every booking conflicts).
        List<Booking> overlapping = (c.getStaffMember() != null)
                ? bookingRepository.findBookingsByStatusesIntersectingRangeForStaff(
                        rangeStart, rangeEnd, BLOCKING_STATUSES, c.getStaffMember().getId())
                : bookingRepository.findBookingsByStatusesIntersectingRange(
                        rangeStart, rangeEnd, BLOCKING_STATUSES);

        List<ConflictBookingInfo> infos = overlapping.stream()
                .map(b -> new ConflictBookingInfo(
                        b.getBookingId(),
                        b.getStartTime(),
                        b.getEndTime(),
                        b.getCustomerName()
                ))
                .toList();
        return new ClosureConflictPreviewDTO(infos.size(), infos);
    }

    // ---------------------------- STAFF RESOLUTION (prompt 03) ----------------------------

    private StaffMember resolveStaffOrNull(UUID staffId) {
        if (staffId == null) return null;
        return staffMemberRepository.findById(staffId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro del team non trovato con id: " + staffId));
    }

    // ---------------------------- CONVERTER ----------------------------
    private ClosureResponseDTO convertToDTO(Closure closure) {
        return new ClosureResponseDTO(
                closure.getId(),
                closure.getStartDate(),  // legacy `date` alias = startDate
                closure.getStartDate(),
                closure.getEndDate(),
                closure.getStartTime(),
                closure.getEndTime(),
                closure.getReason(),
                closure.isFullDay(),
                closure.isMultiDay(),
                closure.getCreatedAt(),
                // LAZY proxy: id access never initializes it (safe outside a fetch join)
                closure.getStaffMember() != null ? closure.getStaffMember().getId() : null
        );
    }
}
