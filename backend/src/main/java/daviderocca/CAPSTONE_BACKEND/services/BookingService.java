package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.NextAvailableSlotDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.Closure;
import daviderocca.CAPSTONE_BACKEND.entities.Customer;
import daviderocca.CAPSTONE_BACKEND.entities.PackageCredit;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceOption;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.entities.WorkingHours;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.ClosureRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.ServiceOptionRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.WorkingHoursRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.param.RefundCreateParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final ServiceItemService serviceItemService;
    private final ServiceOptionRepository serviceOptionRepository;
    private final PackageCreditService packageCreditService;
    private final CustomerService customerService;
    private final WorkingHoursRepository workingHoursRepository;
    private final ClosureRepository closureRepository;

    // FIX-1: chiave Stripe per il rimborso (field injection, non final per compatibilità con @Value)
    @Value("${stripe.secret}")
    private String stripeSecretKey;

    private static final int HOLD_EXPIRE_MINUTES = 12;

    private static final List<BookingStatus> BLOCKING = List.of(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED);

    // ============================ ADMIN LIST ============================
    @Transactional(readOnly = true)
    public Page<BookingResponseDTO> findAllBookings(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort).descending());
        Page<Booking> page = bookingRepository.findAllWithDetails(pageable);
        List<BookingResponseDTO> dtoList = page.getContent().stream().map(this::convertToDTO).toList();
        return new PageImpl<>(dtoList, pageable, page.getTotalElements());
    }

    // ============================ CORE FIND ============================
    @Transactional(readOnly = true)
    public Booking findBookingById(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));
    }

    @Transactional(readOnly = true)
    public BookingResponseDTO findBookingByIdAndConvert(UUID bookingId) {
        Booking booking = bookingRepository.findByIdWithDetails(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));
        return convertToDTO(booking);
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

        Booking hydrated = bookingRepository.findByIdWithDetails(saved.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException(saved.getBookingId()));
        return convertToDTO(hydrated);
    }

    @Transactional
    public Booking save(Booking booking) {
        return bookingRepository.save(booking);
    }

    @Transactional
    public BookingResponseDTO createManualConfirmedBookingAsAdmin(NewBookingDTO payload, User currentUser) {
        if (!isAdmin(currentUser)) throw new UnauthorizedException("Solo un ADMIN può creare prenotazioni manuali.");

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());

        LocalDateTime start = payload.startTime().truncatedTo(ChronoUnit.MINUTES);
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

        // collegamento pacchetto (opzionale)
        if (payload.packageCreditId() != null) {
            PackageCredit pc = packageCreditService.findById(payload.packageCreditId());
            booking.setPackageCredit(pc);
            packageCreditService.validateBookingWithPackage(booking);
        }

        booking.setBookingStatus(BookingStatus.CONFIRMED);   // manuale = confermata
        booking.setPaidAt(null);                             // no Stripe
        booking.setStripeSessionId(null);
        booking.setExpiresAt(null);

        // ── Link booking to customer registry (best-effort, never blocks booking creation) ──
        try {
            Customer customer = customerService.findOrCreate(
                    booking.getCustomerName(),
                    booking.getCustomerPhone(),
                    booking.getCustomerEmail(),
                    payload.notes()
            );
            booking.setCustomer(customer);
        } catch (Exception e) {
            log.warn("Could not upsert customer for booking, proceeding without link: {}", e.getMessage());
        }

        Booking saved = bookingRepository.save(booking);
        log.info("Manual booking created by admin: id={} start={} end={} packageCredit={}",
                saved.getBookingId(), saved.getStartTime(), saved.getEndTime(),
                saved.getPackageCredit() != null ? saved.getPackageCredit().getPackageCreditId() : "none");

        Booking hydrated = bookingRepository.findByIdWithDetails(saved.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException(saved.getBookingId()));
        return convertToDTO(hydrated);
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

    @Transactional(readOnly = true)
    public NextAvailableSlotDTO findNextAvailableSlot(int durationMin, LocalDateTime after) {
        LocalDate startDate = after.toLocalDate();
        LocalTime afterTime = after.toLocalTime();

        for (int i = 0; i < 90; i++) {
            LocalDate day = startDate.plusDays(i);
            DayOfWeek dow = day.getDayOfWeek();

            WorkingHours wh = workingHoursRepository.findByDayOfWeek(dow).orElse(null);
            if (wh == null || wh.isClosed()) continue;

            List<LocalTime[]> openRanges = new ArrayList<>();
            if (wh.getMorningStart() != null && wh.getMorningEnd() != null) {
                openRanges.add(new LocalTime[]{wh.getMorningStart(), wh.getMorningEnd()});
            }
            if (wh.getAfternoonStart() != null && wh.getAfternoonEnd() != null) {
                openRanges.add(new LocalTime[]{wh.getAfternoonStart(), wh.getAfternoonEnd()});
            }
            if (openRanges.isEmpty()) continue;

            List<Closure> closures = closureRepository.findByDate(day);
            boolean fullDayClosed = closures.stream().anyMatch(Closure::isFullDay);
            if (fullDayClosed) continue;

            List<Booking> dayBookings = bookingRepository.findByDateAndStatusNotCancelled(day);
            dayBookings.sort(Comparator.comparing(Booking::getStartTime));

            List<LocalTime[]> closureIntervals = closures.stream()
                    .filter(c -> !c.isFullDay() && c.getStartTime() != null && c.getEndTime() != null)
                    .map(c -> new LocalTime[]{c.getStartTime(), c.getEndTime()})
                    .toList();

            for (LocalTime[] range : openRanges) {
                LocalTime rangeStart = range[0];
                LocalTime rangeEnd = range[1];

                if (i == 0 && rangeEnd.isBefore(afterTime)) continue;
                if (i == 0 && rangeStart.isBefore(afterTime)) {
                    rangeStart = afterTime;
                }

                if (!rangeStart.isBefore(rangeEnd)) continue;

                List<LocalTime[]> booked = new ArrayList<>();

                for (Booking b : dayBookings) {
                    LocalTime bs = b.getStartTime().toLocalTime();
                    LocalTime be = b.getEndTime().toLocalTime();
                    if (be.isAfter(rangeStart) && bs.isBefore(rangeEnd)) {
                        booked.add(new LocalTime[]{bs, be});
                    }
                }

                for (LocalTime[] ci : closureIntervals) {
                    LocalTime cs = ci[0];
                    LocalTime ce = ci[1];
                    if (ce.isAfter(rangeStart) && cs.isBefore(rangeEnd)) {
                        booked.add(new LocalTime[]{cs, ce});
                    }
                }

                booked = booked.stream()
                        .sorted(Comparator.comparing(a -> a[0]))
                        .collect(Collectors.toList());

                LocalTime cursor = rangeStart;
                for (LocalTime[] interval : booked) {
                    LocalTime bs = interval[0];
                    LocalTime be = interval[1];
                    if (be.isBefore(cursor) || !bs.isAfter(rangeStart) && !be.isAfter(cursor)) {
                        continue;
                    }
                    if (bs.isAfter(cursor)) {
                        long gapMin = Duration.between(cursor, bs).toMinutes();
                        if (gapMin >= durationMin) {
                            return new NextAvailableSlotDTO(
                                    day,
                                    cursor,
                                    cursor.plusMinutes(durationMin),
                                    (int) gapMin
                            );
                        }
                    }
                    if (be.isAfter(cursor)) {
                        cursor = be;
                        if (!cursor.isBefore(rangeEnd)) break;
                    }
                }

                if (cursor.isBefore(rangeEnd)) {
                    long tailGap = Duration.between(cursor, rangeEnd).toMinutes();
                    if (tailGap >= durationMin) {
                        return new NextAvailableSlotDTO(
                                day,
                                cursor,
                                cursor.plusMinutes(durationMin),
                                (int) tailGap
                        );
                    }
                }
            }
        }

        return null;
    }

    @Transactional
    public void hardDeleteBooking(UUID bookingId, User currentUser) {
        if (!isAdmin(currentUser)) {
            throw new UnauthorizedException("Solo un admin può eliminare una prenotazione.");
        }

        Booking found = findBookingById(bookingId);

        // Block hard delete for Stripe-paid bookings — refund must be handled first
        if (found.getStripeSessionId() != null) {
            throw new BadRequestException(
                    "Questa prenotazione è stata pagata online. Gestisci prima il rimborso prima di eliminarla."
            );
        }

        bookingRepository.delete(found);
        log.info("Booking hard-deleted by admin: id={}", bookingId);
    }

    // ============================ REFUND (ADMIN) ============================
    // FIX-1: rimborso Stripe per prenotazioni pagate online
    @Transactional(rollbackFor = StripeException.class)
    public void refundBooking(UUID bookingId) throws StripeException {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));

        if (booking.getBookingStatus() != BookingStatus.CONFIRMED) {
            throw new BadRequestException("Il rimborso è possibile solo per prenotazioni in stato CONFIRMED.");
        }
        if (booking.getStripeSessionId() == null) {
            throw new BadRequestException("Questa prenotazione non è stata pagata online (nessuna sessione Stripe).");
        }

        Stripe.apiKey = stripeSecretKey;

        // Recupera il payment_intent dalla sessione Stripe
        Session stripeSession = Session.retrieve(booking.getStripeSessionId());
        String paymentIntentId = stripeSession.getPaymentIntent();
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new BadRequestException("Nessun payment_intent trovato per la sessione Stripe di questa prenotazione.");
        }

        // Crea il rimborso su Stripe
        RefundCreateParams refundParams = RefundCreateParams.builder()
                .setPaymentIntent(paymentIntentId)
                .build();
        Refund.create(refundParams);

        // Aggiorna lo stato del booking a CANCELLED
        booking.setBookingStatus(BookingStatus.CANCELLED);
        booking.setCanceledAt(LocalDateTime.now());
        booking.setCancelReason("ADMIN_REFUND");
        booking.setExpiresAt(null);
        bookingRepository.save(booking);

        log.info("FIX-1 | Booking refunded and cancelled: bookingId={} stripeSession={}",
                bookingId, booking.getStripeSessionId());
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

        Booking found = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));
        BookingStatus old = found.getBookingStatus();

        // Idempotenza: nessuna azione se lo stato è già quello richiesto
        if (old == newStatus) {
            log.info("Booking status update no-op (idempotente): id={} status={}", bookingId, newStatus);
            return convertToDTO(found);
        }
        if (old == BookingStatus.CANCELLED) throw new BadRequestException("Prenotazione CANCELLED: non modificabile.");

        if (newStatus == BookingStatus.COMPLETED) {
            found.setCompletedAt(LocalDateTime.now());
        }
        if (newStatus == BookingStatus.CANCELLED) {
            found.setCanceledAt(LocalDateTime.now());
            found.setCancelReason("ADMIN_CANCEL");
            found.setExpiresAt(null);
        }
        if (newStatus == BookingStatus.NO_SHOW) {
            found.setCanceledAt(LocalDateTime.now());
            found.setCancelReason("NO_SHOW");
        }

        // FIX-23: rimosso blocco CANCELLED duplicato che sovrascriveva cancelReason senza utilità

        // --- gestione pacchetto: scalatura/rollback seduta ---
        boolean wasCompleted  = (old == BookingStatus.COMPLETED);
        boolean willBeCompleted = (newStatus == BookingStatus.COMPLETED);

        if (!wasCompleted && willBeCompleted) {
            // transizione verso COMPLETED → scala una seduta
            packageCreditService.consumeSessionForBooking(found);
        } else if (wasCompleted && !willBeCompleted) {
            // rollback da COMPLETED → ripristina la seduta
            packageCreditService.restoreSessionForBooking(found);
        }

        found.setBookingStatus(newStatus);
        Booking updated = bookingRepository.save(found);

        log.info("Booking status updated: id={} {} -> {} packageCredit={}",
                updated.getBookingId(), old, newStatus,
                updated.getPackageCredit() != null ? updated.getPackageCredit().getPackageCreditId() : "none");
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

        if (found.getBookingStatus() == BookingStatus.CONFIRMED && found.getStripeSessionId() != null) {
            throw new BadRequestException("Questa prenotazione è stata pagata online. Gestisci prima il rimborso.");
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
        var pkg = b.getPackageCredit();

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
                b.getNotes(),
                pkg != null ? pkg.getPackageCreditId() : null,
                pkg != null ? pkg.getSessionsRemaining() : null,
                pkg != null ? pkg.getSessionsTotal() : null,
                pkg != null ? pkg.getStatus() : null,
                b.getStripeSessionId()
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
                booking.getUser() != null ? booking.getUser().getUserId() : null,
                // FIX-18: titolo del servizio per evitare UUID grezzo in BookingSuccessPage
                booking.getService() != null ? booking.getService().getTitle() : null
        );
    }

    private static <T> T requireNotNull(T value, String message) {
        if (value == null) throw new BadRequestException(message);
        return value;
    }
}