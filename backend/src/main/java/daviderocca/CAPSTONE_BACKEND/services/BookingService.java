package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceOption;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.ServiceOptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final ServiceItemService serviceItemService;
    private final ServiceOptionRepository serviceOptionRepository;

    // Status che bloccano gli slot
    private static final List<BookingStatus> BLOCKING = List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED);

    // ---------------------------- ADMIN: LIST PAGINATA ----------------------------
    @Transactional(readOnly = true)
    public Page<BookingResponseDTO> findAllBookings(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        return bookingRepository.findAll(pageable).map(this::convertToDTO);
    }

    // ---------------------------- CORE FIND ----------------------------
    @Transactional(readOnly = true)
    public Booking findBookingById(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));
    }

    @Transactional(readOnly = true)
    public BookingResponseDTO findBookingByIdAndConvert(UUID bookingId) {
        return convertToDTO(findBookingById(bookingId));
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDTO> findBookingByEmailAndConvert(String email) {
        if (email == null || email.trim().isEmpty()) throw new BadRequestException("Email obbligatoria.");
        String normalized = email.trim().toLowerCase();
        return bookingRepository.findByCustomerEmailIgnoreCase(normalized)
                .stream()
                .map(this::convertToDTO)
                .toList();
    }

    // ---------------------------------- CREATE (ATOMICA) ----------------------------------
    @Transactional
    public BookingResponseDTO saveBooking(NewBookingDTO payload, User currentUser) {

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());

        LocalDateTime start = normalizeStart(payload.startTime());
        LocalDateTime end = start.plusMinutes(serviceItem.getDurationMin());

        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);

        // LOCK atomico (online-safe)
        if (!bookingRepository.lockOverlappingBookingsByStatuses(start, end, BLOCKING).isEmpty()) {
            log.warn("Tentativo doppia prenotazione (CREATE): range {} - {}", start, end);
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }

        String name = safeTrim(payload.customerName(), "Nome cliente obbligatorio");
        String email = safeTrim(payload.customerEmail(), "Email cliente obbligatoria").toLowerCase();
        String phone = safeTrim(payload.customerPhone(), "Telefono cliente obbligatorio");

        Booking newBooking = new Booking(
                name,
                email,
                phone,
                start,
                end,
                payload.notes(),
                serviceItem,
                option,
                currentUser
        );

        Booking saved = bookingRepository.save(newBooking);

        log.info("Prenotazione creata: id={} start={} end={} serviceId={} optionId={} status={} userId={}",
                saved.getBookingId(),
                saved.getStartTime(),
                saved.getEndTime(),
                saved.getService().getServiceId(),
                saved.getServiceOption() != null ? saved.getServiceOption().getOptionId() : null,
                saved.getBookingStatus(),
                saved.getUser() != null ? saved.getUser().getUserId() : null
        );

        return convertToDTO(saved);
    }

    // ---------------------------------- UPDATE (ATOMICA) ----------------------------------
    @Transactional
    public BookingResponseDTO updateBooking(UUID bookingId, NewBookingDTO payload, User currentUser) {

        Booking found = findBookingById(bookingId);

        if (found.getBookingStatus() == BookingStatus.CANCELLED || found.getBookingStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Non puoi modificare una prenotazione già " + found.getBookingStatus());
        }

        // Permessi: admin oppure owner (solo se la prenotazione è di un utente)
        if (!isAdmin(currentUser)) {
            if (found.getUser() == null || !found.getUser().getUserId().equals(currentUser.getUserId())) {
                throw new UnauthorizedException("Non puoi modificare una prenotazione non tua.");
            }
        }

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());

        LocalDateTime start = normalizeStart(payload.startTime());
        LocalDateTime end = start.plusMinutes(serviceItem.getDurationMin());

        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);

        // LOCK atomico update
        if (!bookingRepository.lockOverlappingBookingsByStatusesExcluding(found.getBookingId(), start, end, BLOCKING).isEmpty()) {
            log.warn("Tentativo overlap (UPDATE): bookingId={} range {} - {}", bookingId, start, end);
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }

        found.setCustomerName(safeTrim(payload.customerName(), "Nome cliente obbligatorio"));
        found.setCustomerEmail(safeTrim(payload.customerEmail(), "Email cliente obbligatoria").toLowerCase());
        found.setCustomerPhone(safeTrim(payload.customerPhone(), "Telefono cliente obbligatorio"));
        found.setStartTime(start);
        found.setEndTime(end);
        found.setNotes(payload.notes());
        found.setService(serviceItem);
        found.setServiceOption(option);

        Booking updated = bookingRepository.save(found);

        log.info("Prenotazione aggiornata: id={} start={} end={} serviceId={} optionId={} status={}",
                updated.getBookingId(),
                updated.getStartTime(),
                updated.getEndTime(),
                updated.getService().getServiceId(),
                updated.getServiceOption() != null ? updated.getServiceOption().getOptionId() : null,
                updated.getBookingStatus()
        );

        return convertToDTO(updated);
    }

    // ---------------------------------- UPDATE STATUS (ADMIN) ----------------------------------
    @Transactional
    public BookingResponseDTO updateBookingStatus(UUID bookingId, BookingStatus newStatus, User currentUser) {

        if (!isAdmin(currentUser)) {
            throw new UnauthorizedException("Solo un ADMIN può aggiornare lo stato della prenotazione.");
        }
        if (newStatus == null) throw new BadRequestException("Status non valido.");

        Booking found = findBookingById(bookingId);

        if (found.getBookingStatus() == BookingStatus.CANCELLED || found.getBookingStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Non puoi aggiornare lo stato di una prenotazione già " + found.getBookingStatus());
        }
        if (found.getBookingStatus() == newStatus) {
            throw new BadRequestException("La prenotazione è già nello stato richiesto.");
        }

        BookingStatus old = found.getBookingStatus(); // FIX log
        found.setBookingStatus(newStatus);

        Booking updated = bookingRepository.save(found);

        log.info("Stato prenotazione aggiornato: id={} {} -> {}",
                updated.getBookingId(), old, newStatus);

        return convertToDTO(updated);
    }

    // ---------------------------------- DELETE ----------------------------------
    @Transactional
    public void deleteBooking(UUID bookingId, User currentUser) {

        Booking found = findBookingById(bookingId);
        boolean admin = isAdmin(currentUser);

        if (!admin) {
            if (found.getUser() == null || !found.getUser().getUserId().equals(currentUser.getUserId())) {
                throw new UnauthorizedException("Non puoi cancellare una prenotazione non tua.");
            }
            if (found.getStartTime().isBefore(LocalDateTime.now().plusHours(24))) {
                throw new BadRequestException("Puoi cancellare la prenotazione solo fino a 24 ore prima.");
            }
        }

        bookingRepository.delete(found);
        log.info("Prenotazione eliminata: id={}", bookingId);
    }

    // ---------------------------------- ADMIN: AGENDA (NO N+1) ----------------------------------
    @Transactional(readOnly = true)
    public List<AdminBookingCardDTO> getAgendaDay(LocalDate date) {
        if (date == null) throw new BadRequestException("Data non valida.");
        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to = date.plusDays(1).atStartOfDay();
        return bookingRepository.findAgendaRangeWithDetails(from, to).stream()
                .map(this::toAdminCard)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminBookingCardDTO> getAgendaRange(LocalDate fromDate, LocalDate toDateExclusive) {
        if (fromDate == null || toDateExclusive == null) throw new BadRequestException("Range non valido.");
        if (!fromDate.isBefore(toDateExclusive)) throw new BadRequestException("Range non valido (from < to).");

        LocalDateTime from = fromDate.atStartOfDay();
        LocalDateTime to = toDateExclusive.atStartOfDay();

        return bookingRepository.findAgendaRangeWithDetails(from, to).stream()
                .map(this::toAdminCard)
                .toList();
    }

    // Usato da AvailabilityService (blocca PENDING/CONFIRMED)
    @Transactional(readOnly = true)
    public List<Booking> findBlockingBookingsInRange(LocalDateTime from, LocalDateTime to) {
        return bookingRepository.findBookingsByStatusesIntersectingRange(from, to, BLOCKING);
    }

    private AdminBookingCardDTO toAdminCard(Booking b) {
        return new AdminBookingCardDTO(
                b.getBookingId(),
                b.getStartTime(),
                b.getEndTime(),
                b.getBookingStatus(),
                b.getCustomerName(),
                b.getCustomerPhone(),
                b.getCustomerEmail(),
                b.getService() != null ? b.getService().getTitle() : null,
                b.getService() != null ? b.getService().getServiceId() : null,
                b.getServiceOption() != null ? b.getServiceOption().getName() : null,
                b.getServiceOption() != null ? b.getServiceOption().getOptionId() : null,
                b.getNotes()
        );
    }

    // ---------------------------------- HELPERS ----------------------------------
    private LocalDateTime normalizeStart(LocalDateTime startTime) {
        LocalDateTime start = requireNotNull(startTime, "La data e ora di inizio non può essere nulla")
                .truncatedTo(ChronoUnit.MINUTES);

        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES);
        if (start.isBefore(now)) {
            throw new BadRequestException("L'orario di inizio non può essere nel passato.");
        }
        return start;
    }

    private ServiceOption resolveAndValidateOption(UUID optionId, ServiceItem serviceItem) {
        if (optionId == null) return null;

        ServiceOption option = serviceOptionRepository.findById(optionId)
                .orElseThrow(() -> new BadRequestException("Opzione servizio non trovata."));

        if (!option.getService().getServiceId().equals(serviceItem.getServiceId())) {
            throw new BadRequestException("L'opzione selezionata non appartiene al servizio scelto.");
        }
        if (!option.isActive()) {
            throw new BadRequestException("L'opzione selezionata non è attiva.");
        }
        return option;
    }

    private boolean isAdmin(User user) {
        return user != null && user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private String safeTrim(String v, String messageIfBlank) {
        if (v == null) throw new BadRequestException(messageIfBlank);
        String t = v.trim();
        if (t.isEmpty()) throw new BadRequestException(messageIfBlank);
        return t;
    }

    private BookingResponseDTO convertToDTO(Booking booking) {
        return new BookingResponseDTO(
                booking.getBookingId(),
                booking.getCustomerName(),
                booking.getCustomerEmail(),
                booking.getCustomerPhone(),
                booking.getStartTime(),
                booking.getEndTime(),
                booking.getBookingStatus(),
                booking.getNotes(),
                booking.getCreatedAt(),
                booking.getService() != null ? booking.getService().getServiceId() : null,
                booking.getServiceOption() != null ? booking.getServiceOption().getOptionId() : null,
                booking.getUser() != null ? booking.getUser().getUserId() : null
        );
    }

    private static <T> T requireNotNull(T value, String message) {
        if (value == null) throw new BadRequestException(message);
        return value;
    }
}