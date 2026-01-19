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

    private static final int HOLD_EXPIRE_MINUTES = 12;

    private static final List<BookingStatus> BLOCKING = List.of(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED);

    // ============================ ADMIN LIST ============================
    @Transactional(readOnly = true)
    public Page<BookingResponseDTO> findAllBookings(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort).descending());
        return bookingRepository.findAll(pageable).map(this::convertToDTO);
    }

    // ============================ CORE FIND ============================
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
    public List<BookingResponseDTO> findBookingsForCurrentUser(User currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new UnauthorizedException("Utente non autenticato.");
        }

        return bookingRepository.findByUserIdOrderByStartTimeDesc(currentUser.getUserId())
                .stream()
                .map(this::convertToDTO)
                .toList();
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

    // ============================ HOLD CREATE (used by Stripe checkout) ============================
    @Transactional
    public BookingResponseDTO createHoldBooking(NewBookingDTO payload, User currentUserOrNull) {

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());

        LocalDateTime start = normalizeStart(payload.startTime());
        LocalDateTime end = start.plusMinutes(serviceItem.getDurationMin());

        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);

        if (!bookingRepository.lockOverlappingBookingsByStatuses(start, end, BLOCKING).isEmpty()) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }

        String name = safeTrim(payload.customerName(), "Nome cliente obbligatorio");
        String phone = safeTrim(payload.customerPhone(), "Telefono cliente obbligatorio");
        String email = safeTrim(payload.customerEmail(), "Email cliente obbligatoria").toLowerCase();

        User user = (currentUserOrNull != null && currentUserOrNull.getUserId() != null) ? currentUserOrNull : null;

        Booking booking = new Booking(
                name,
                email,
                phone,
                start,
                end,
                payload.notes(),
                serviceItem,
                option,
                user
        );

        booking.setBookingStatus(BookingStatus.PENDING_PAYMENT);
        booking.setExpiresAt(LocalDateTime.now().plusMinutes(HOLD_EXPIRE_MINUTES));
        booking.setStripeSessionId(null);
        booking.setPaidAt(null);
        booking.setCanceledAt(null);
        booking.setCancelReason(null);
        booking.setCompletedAt(null);

        Booking saved = bookingRepository.save(booking);
        log.info("Booking HOLD created: id={} status={} expiresAt={}", saved.getBookingId(), saved.getBookingStatus(), saved.getExpiresAt());

        return convertToDTO(saved);
    }

    @Transactional
    public Booking save(Booking booking) {
        return bookingRepository.save(booking);
    }

    @Transactional
    public BookingResponseDTO createManualConfirmedBookingAsAdmin(NewBookingDTO payload, User currentUser) {
        if (!isAdmin(currentUser)) throw new UnauthorizedException("Solo un ADMIN può creare prenotazioni manuali.");

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());

        LocalDateTime start = normalizeStart(payload.startTime());
        LocalDateTime end = start.plusMinutes(serviceItem.getDurationMin());

        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);

        if (!bookingRepository.lockOverlappingBookingsByStatuses(start, end, BLOCKING).isEmpty()) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }

        Booking booking = new Booking(
                safeTrim(payload.customerName(), "Nome cliente obbligatorio"),
                safeTrim(payload.customerEmail(), "Email cliente obbligatoria").toLowerCase(),
                safeTrim(payload.customerPhone(), "Telefono cliente obbligatorio"),
                start,
                end,
                payload.notes(),
                serviceItem,
                option,
                null
        );

        booking.setBookingStatus(BookingStatus.CONFIRMED);   // manuale = confermata
        booking.setPaidAt(null);                             // no Stripe
        booking.setStripeSessionId(null);
        booking.setExpiresAt(null);

        Booking saved = bookingRepository.save(booking);
        log.info("Manual booking created by admin: id={} start={} end={}", saved.getBookingId(), saved.getStartTime(), saved.getEndTime());

        return convertToDTO(saved);
    }

    @Transactional
    public void attachStripeSession(UUID bookingId, String stripeSessionId) {
        if (stripeSessionId == null || stripeSessionId.trim().isEmpty()) {
            throw new BadRequestException("stripeSessionId non valido.");
        }

        Booking booking = findBookingById(bookingId);

        if (booking.getBookingStatus() != BookingStatus.PENDING_PAYMENT) {
            log.warn("attachStripeSession ignored: bookingId={} status={}", bookingId, booking.getBookingStatus());
            return;
        }

        booking.setStripeSessionId(stripeSessionId.trim());
        bookingRepository.save(booking);

        log.info("Stripe session attached to booking: bookingId={} sessionId={}", bookingId, stripeSessionId);
    }

    @Transactional
    public void confirmPaidBookingFromWebhook(Booking booking, String customerEmailFromStripe) {

        // idempotenza
        if (booking.getBookingStatus() == BookingStatus.CONFIRMED || booking.getBookingStatus() == BookingStatus.COMPLETED) {
            return;
        }

        if (customerEmailFromStripe != null && booking.getCustomerEmail() != null) {
            String a = booking.getCustomerEmail().trim().toLowerCase();
            String b = customerEmailFromStripe.trim().toLowerCase();
            if (!a.equals(b)) {
                log.warn("Email mismatch bookingId={} dbEmail={} stripeEmail={}", booking.getBookingId(), a, b);
            }
        }

        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setPaidAt(LocalDateTime.now());
        booking.setExpiresAt(null);
        bookingRepository.save(booking);
    }

    @Transactional
    public boolean hasBlockingConflictExcluding(Booking booking) {
        if (booking == null) return true;
        if (booking.getStartTime() == null || booking.getEndTime() == null) return true;

        List<Booking> overlaps = bookingRepository.lockOverlappingBookingsByStatusesExcluding(
                booking.getBookingId(),
                booking.getStartTime(),
                booking.getEndTime(),
                BLOCKING
        );
        return !overlaps.isEmpty();
    }

    @Transactional
    public void markBookingAsPaidAndConfirm(UUID bookingId, String customerEmailFromStripe) {
        Booking booking = findBookingById(bookingId);

        // idempotenza
        if (booking.getBookingStatus() == BookingStatus.CONFIRMED || booking.getBookingStatus() == BookingStatus.COMPLETED) {
            log.warn("Webhook confirm ignored: bookingId={} status={}", bookingId, booking.getBookingStatus());
            return;
        }

        // se è stata cancellata/scaduta nel frattempo
        if (booking.getBookingStatus() == BookingStatus.CANCELLED) {
            log.warn("Webhook paid on CANCELLED booking: bookingId={}", bookingId);
            return;
        }

        // se hold scaduto ma non ancora processato dallo scheduler: blocca conferma
        if (booking.getExpiresAt() != null && booking.getExpiresAt().isBefore(LocalDateTime.now())) {
            booking.setBookingStatus(BookingStatus.CANCELLED);
            booking.setCanceledAt(LocalDateTime.now());
            booking.setCancelReason("EXPIRED_BEFORE_WEBHOOK");
            bookingRepository.save(booking);
            log.warn("Webhook paid but booking already expired: bookingId={}", bookingId);
            return;
        }

        if (customerEmailFromStripe != null && booking.getCustomerEmail() != null) {
            String a = booking.getCustomerEmail().trim().toLowerCase();
            String b = customerEmailFromStripe.trim().toLowerCase();
            if (!a.equals(b)) {
                log.warn("Email mismatch bookingId={} dbEmail={} stripeEmail={}", bookingId, a, b);
            }
        }

        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setPaidAt(LocalDateTime.now());
        booking.setExpiresAt(null);
        bookingRepository.save(booking);

        log.info("Booking confirmed (paid): bookingId={} email={}", bookingId, customerEmailFromStripe);
    }

    @Transactional
    public int expirePendingBookings() {
        LocalDateTime now = LocalDateTime.now();
        List<Booking> expired = bookingRepository.findByBookingStatusAndExpiresAtBefore(BookingStatus.PENDING_PAYMENT, now);

        for (Booking b : expired) {
            if (b.getBookingStatus() != BookingStatus.PENDING_PAYMENT) continue;

            b.setBookingStatus(BookingStatus.CANCELLED);
            b.setCanceledAt(now);
            b.setCancelReason("EXPIRED");
            b.setExpiresAt(null);
        }

        bookingRepository.saveAll(expired);
        if (!expired.isEmpty()) log.info("Expired bookings: {}", expired.size());
        return expired.size();
    }

    // ============================ UPDATE (ADMIN/OWNER) ============================
    @Transactional
    public BookingResponseDTO updateBooking(UUID bookingId, NewBookingDTO payload, User currentUser) {

        Booking found = findBookingById(bookingId);

        boolean admin = isAdmin(currentUser);
        if (!admin) {
            // owner only if linked to user
            if (currentUser == null || currentUser.getUserId() == null) throw new UnauthorizedException("Utente non autenticato.");
            if (found.getUser() == null || !found.getUser().getUserId().equals(currentUser.getUserId())) {
                throw new UnauthorizedException("Non puoi modificare una prenotazione non tua.");
            }
        }

        if (found.getBookingStatus() == BookingStatus.CANCELLED || found.getBookingStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Non puoi modificare una prenotazione già " + found.getBookingStatus());
        }

        if (!admin && found.getBookingStatus() == BookingStatus.CONFIRMED) {
            throw new BadRequestException("Prenotazione già confermata: contatta il centro per modifiche.");
        }

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());

        LocalDateTime start = normalizeStart(payload.startTime());
        LocalDateTime end = start.plusMinutes(serviceItem.getDurationMin());

        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);

        if (!bookingRepository.lockOverlappingBookingsByStatusesExcluding(found.getBookingId(), start, end, BLOCKING).isEmpty()) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }

        found.setStartTime(start);
        found.setEndTime(end);
        found.setService(serviceItem);
        found.setServiceOption(option);
        found.setNotes(payload.notes());

        // admin può cambiare anche i dati cliente
        if (admin) {
            found.setCustomerName(safeTrim(payload.customerName(), "Nome cliente obbligatorio"));
            found.setCustomerEmail(safeTrim(payload.customerEmail(), "Email cliente obbligatoria").toLowerCase());
            found.setCustomerPhone(safeTrim(payload.customerPhone(), "Telefono cliente obbligatorio"));
        }

        Booking updated = bookingRepository.save(found);
        log.info("Booking updated: id={} status={}", updated.getBookingId(), updated.getBookingStatus());
        return convertToDTO(updated);
    }

    // ============================ ADMIN: STATUS ============================
    @Transactional
    public BookingResponseDTO updateBookingStatus(UUID bookingId, BookingStatus newStatus, User currentUser) {

        if (!isAdmin(currentUser)) throw new UnauthorizedException("Solo un ADMIN può aggiornare lo stato della prenotazione.");
        if (newStatus == null) throw new BadRequestException("Status non valido.");

        Booking found = findBookingById(bookingId);
        BookingStatus old = found.getBookingStatus();

        if (old == newStatus) throw new BadRequestException("La prenotazione è già nello stato richiesto.");
        if (old == BookingStatus.CANCELLED) throw new BadRequestException("Prenotazione CANCELLED: non modificabile.");

        if (newStatus == BookingStatus.COMPLETED) {
            found.setCompletedAt(LocalDateTime.now());
        }
        if (newStatus == BookingStatus.NO_SHOW) {
        }

        found.setBookingStatus(newStatus);
        Booking updated = bookingRepository.save(found);

        log.info("Booking status updated: id={} {} -> {}", updated.getBookingId(), old, newStatus);
        return convertToDTO(updated);
    }

    // ============================ CANCEL (SOFT) ============================
    @Transactional
    public void cancelBooking(UUID bookingId, User currentUser, String reason) {

        Booking found = findBookingById(bookingId);

        boolean admin = isAdmin(currentUser);
        if (!admin) {
            if (currentUser == null || currentUser.getUserId() == null) throw new UnauthorizedException("Utente non autenticato.");
            if (found.getUser() == null || !found.getUser().getUserId().equals(currentUser.getUserId())) {
                throw new UnauthorizedException("Non puoi cancellare una prenotazione non tua.");
            }

            // regola 24h
            if (found.getStartTime().isBefore(LocalDateTime.now().plusHours(24))) {
                throw new BadRequestException("Puoi cancellare la prenotazione solo fino a 24 ore prima.");
            }
        }

        if (found.getBookingStatus() == BookingStatus.CANCELLED) return;
        if (found.getBookingStatus() == BookingStatus.COMPLETED) throw new BadRequestException("Non puoi cancellare una prenotazione COMPLETED.");

        if (found.getBookingStatus() == BookingStatus.CONFIRMED) {
            throw new BadRequestException("Prenotazione già pagata: per annullarla serve procedura rimborso.");
        }

        found.setBookingStatus(BookingStatus.CANCELLED);
        found.setCanceledAt(LocalDateTime.now());
        found.setCancelReason((reason == null || reason.trim().isEmpty()) ? (admin ? "ADMIN_CANCEL" : "USER_CANCEL") : reason.trim());
        found.setExpiresAt(null);

        bookingRepository.save(found);
        log.info("Booking cancelled: id={} reason={}", bookingId, found.getCancelReason());
    }

    // ============================ ADMIN AGENDA ============================
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

    // ============================ HELPERS ============================
    private LocalDateTime normalizeStart(LocalDateTime startTime) {
        LocalDateTime start = requireNotNull(startTime, "La data e ora di inizio non può essere nulla")
                .truncatedTo(ChronoUnit.MINUTES);

        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES);
        if (start.isBefore(now)) throw new BadRequestException("L'orario di inizio non può essere nel passato.");
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