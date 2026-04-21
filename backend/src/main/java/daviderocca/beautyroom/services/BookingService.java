package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.NextAvailableSlotDTO;
import daviderocca.beautyroom.email.outbox.EmailOutboxService;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Closure;
import daviderocca.beautyroom.entities.Customer;
import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.entities.WorkingHours;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.NotificationType;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.exceptions.UnauthorizedException;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ClosureRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import daviderocca.beautyroom.repositories.WorkingHoursRepository;
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
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
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
    private final AdminNotificationService notificationService;
    private final WaitlistService waitlistService;
    private final EmailOutboxService emailOutboxService;

    @Value("${stripe.secret}")
    private String stripeSecretKey;

    @Value("${booking.hold.expire-minutes:12}")
    private int holdExpireMinutes;

    private static final List<BookingStatus> BLOCKING = List.of(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED);

    /**
     * Finestra di sicurezza per il padding: valore massimo ragionevole di paddingMinutes.
     * Serve a allargare la finestra di ricerca overlap per trovare booking il cui
     * endTime + paddingMinutes si sovrappone allo slot richiesto.
     */
    private static final int MAX_PADDING_MINUTES = 480;

    private static final DateTimeFormatter NOTIF_FMT =
        DateTimeFormatter.ofPattern("dd/MM 'alle' HH:mm");

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

    // ============================ HOLD CREATE (Stripe checkout) ============================
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public BookingResponseDTO createHoldBooking(NewBookingDTO payload, User currentUserOrNull) {

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());
        serviceItemService.assertServiceActive(serviceItem);

        LocalDateTime start = normalizeStart(payload.startTime());
        LocalDateTime end = start.plusMinutes(serviceItem.getDurationMin());

        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);

        if (hasOverlapIncludingPadding(start, end)) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }

        String name  = safeTrim(payload.customerName(), "Nome cliente obbligatorio");
        String phone = safeTrim(payload.customerPhone(), "Telefono cliente obbligatorio");
        String email = safeTrim(payload.customerEmail(), "Email cliente obbligatoria").toLowerCase();

        User user = (currentUserOrNull != null && currentUserOrNull.getUserId() != null) ? currentUserOrNull : null;

        Booking booking = new Booking(name, email, phone, start, end, payload.notes(), serviceItem, option, user);
        booking.setCreatedByAdmin(false);
        booking.setConsentLaser(payload.consentLaser());
        booking.setConsentPmu(payload.consentPmu());
        if (payload.consentLaser() || payload.consentPmu()) {
            booking.setConsentAt(LocalDateTime.now());
        } else {
            booking.setConsentAt(null);
        }

        booking.setBookingStatus(BookingStatus.PENDING_PAYMENT);
        booking.setExpiresAt(LocalDateTime.now().plusMinutes(holdExpireMinutes));
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

    // ============================ MANUAL ADMIN CREATE ============================
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public BookingResponseDTO createManualConfirmedBookingAsAdmin(NewBookingDTO payload, User currentUser) {
        if (!isAdmin(currentUser)) throw new UnauthorizedException("Solo un ADMIN può creare prenotazioni manuali.");

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());
        serviceItemService.assertServiceActive(serviceItem);

        LocalDateTime start = payload.startTime().truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime end   = start.plusMinutes(serviceItem.getDurationMin());

        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);

        if (hasOverlapIncludingPadding(start, end)) {
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
        booking.setConsentLaser(payload.consentLaser());
        booking.setConsentPmu(payload.consentPmu());
        if (payload.consentLaser() || payload.consentPmu()) {
            booking.setConsentAt(LocalDateTime.now());
        } else {
            booking.setConsentAt(null);
        }

        if (payload.packageCreditId() != null) {
            PackageCredit pc = packageCreditService.findById(payload.packageCreditId());
            booking.setPackageCredit(pc);
            packageCreditService.validateBookingWithPackage(booking);
        }

        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setPaidAt(null);
        booking.setStripeSessionId(null);
        booking.setExpiresAt(null);
        booking.setCreatedByAdmin(true);

        // FIX B4: rimossa notifica per prenotazioni manuali admin.
        // L'admin sa già cosa ha creato — solo le prenotazioni online (webhook Stripe)
        // generano notifiche. Il blocco notificationService.create(...) è stato rimosso.

        // FEATURE paddingMinutes: buffer post-trattamento impostabile dall'admin
        if (payload.paddingMinutes() != null && payload.paddingMinutes() > 0) {
            booking.setPaddingMinutes(payload.paddingMinutes());
        }

        // Link booking to customer registry (best-effort, never blocks booking creation)
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
        log.info("Manual booking created by admin: id={} start={} end={} padding={}min packageCredit={}",
                saved.getBookingId(), saved.getStartTime(), saved.getEndTime(),
                saved.getPaddingMinutes(),
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
        if (booking.getBookingStatus() == BookingStatus.CONFIRMED || booking.getBookingStatus() == BookingStatus.COMPLETED) return;

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

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public boolean hasBlockingConflictExcluding(Booking booking) {
        if (booking == null) return true;
        if (booking.getStartTime() == null || booking.getEndTime() == null) return true;
        return hasOverlapIncludingPaddingExcluding(booking.getBookingId(), booking.getStartTime(), booking.getEndTime());
    }

    @Transactional
    public void markBookingAsPaidAndConfirm(UUID bookingId, String customerEmailFromStripe) {
        Booking booking = findBookingById(bookingId);

        if (booking.getBookingStatus() == BookingStatus.CONFIRMED || booking.getBookingStatus() == BookingStatus.COMPLETED) {
            log.warn("Webhook confirm ignored: bookingId={} status={}", bookingId, booking.getBookingStatus());
            return;
        }
        if (booking.getBookingStatus() == BookingStatus.CANCELLED) {
            log.warn("Webhook paid on CANCELLED booking: bookingId={}", bookingId);
            return;
        }
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
            if (!a.equals(b)) log.warn("Email mismatch bookingId={} dbEmail={} stripeEmail={}", bookingId, a, b);
        }

        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setPaidAt(LocalDateTime.now());
        booking.setExpiresAt(null);
        bookingRepository.save(booking);
        log.info("Booking confirmed (paid): bookingId={} email={}", bookingId, customerEmailFromStripe);

        // Notifica SOLO per prenotazioni online (webhook Stripe) non create manualmente da admin
        if (!booking.isCreatedByAdmin()) {
            try {
                String svc  = booking.getService() != null ? booking.getService().getTitle() : "Trattamento";
                String when = booking.getStartTime().format(NOTIF_FMT);
                notificationService.create(
                    NotificationType.NEW_BOOKING,
                    "Nuova prenotazione online 🗓",
                    booking.getCustomerName() + " · " + svc + " · " + when,
                    booking.getBookingId(),
                    "BOOKING"
                );
            } catch (Exception e) {
                log.warn("Notification skipped for booking {}: {}", bookingId, e.getMessage());
            }
        }
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
            if (wh.getMorningStart() != null && wh.getMorningEnd() != null)
                openRanges.add(new LocalTime[]{wh.getMorningStart(), wh.getMorningEnd()});
            if (wh.getAfternoonStart() != null && wh.getAfternoonEnd() != null)
                openRanges.add(new LocalTime[]{wh.getAfternoonStart(), wh.getAfternoonEnd()});
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
                LocalTime rangeEnd   = range[1];

                if (i == 0 && rangeEnd.isBefore(afterTime)) continue;
                if (i == 0 && rangeStart.isBefore(afterTime)) rangeStart = afterTime;
                if (!rangeStart.isBefore(rangeEnd)) continue;

                List<LocalTime[]> booked = new ArrayList<>();

                for (Booking b : dayBookings) {
                    LocalTime bs = b.getStartTime().toLocalTime();
                    // FEATURE: applica paddingMinutes anche nel finder slot successivo
                    int padding = (b.getPaddingMinutes() != null && b.getPaddingMinutes() > 0) ? b.getPaddingMinutes() : 0;
                    LocalTime be = b.getEndTime().toLocalTime().plusMinutes(padding);
                    if (be.isAfter(rangeStart) && bs.isBefore(rangeEnd))
                        booked.add(new LocalTime[]{bs, be});
                }

                for (LocalTime[] ci : closureIntervals) {
                    LocalTime cs = ci[0];
                    LocalTime ce = ci[1];
                    if (ce.isAfter(rangeStart) && cs.isBefore(rangeEnd))
                        booked.add(new LocalTime[]{cs, ce});
                }

                booked = booked.stream()
                        .sorted(Comparator.comparing(a -> a[0]))
                        .collect(Collectors.toList());

                LocalTime cursor = rangeStart;
                for (LocalTime[] interval : booked) {
                    LocalTime bs = interval[0];
                    LocalTime be = interval[1];
                    if (be.isBefore(cursor) || !bs.isAfter(rangeStart) && !be.isAfter(cursor)) continue;
                    if (bs.isAfter(cursor)) {
                        long gapMin = Duration.between(cursor, bs).toMinutes();
                        if (gapMin >= durationMin) {
                            return new NextAvailableSlotDTO(day, cursor, cursor.plusMinutes(durationMin), (int) gapMin);
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
                        return new NextAvailableSlotDTO(day, cursor, cursor.plusMinutes(durationMin), (int) tailGap);
                    }
                }
            }
        }
        return null;
    }

    // ============================ HARD DELETE ============================
    @Transactional
    public void hardDeleteBooking(UUID bookingId, User currentUser) {
        if (!isAdmin(currentUser)) {
            throw new UnauthorizedException("Solo un admin può eliminare una prenotazione.");
        }

        Booking found = findBookingById(bookingId);

        // FIX B3: blocca la delete solo se la prenotazione è pagata online E non ancora cancellata.
        // Se è già CANCELLED il rimborso è stato gestito (o non c'era pagamento online):
        // la delete è sempre sicura in quel caso.
        boolean isPaidOnline = found.getStripeSessionId() != null;
        boolean isCancelled  = found.getBookingStatus() == BookingStatus.CANCELLED;

        if (isPaidOnline && !isCancelled) {
            throw new BadRequestException(
                    "Questa prenotazione è stata pagata online. Gestisci prima il rimborso prima di eliminarla."
            );
        }

        bookingRepository.delete(found);
        log.info("Booking hard-deleted by admin: id={}", bookingId);
    }

    // ============================ REFUND (ADMIN) ============================
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

        Session stripeSession = Session.retrieve(booking.getStripeSessionId());
        String paymentIntentId = stripeSession.getPaymentIntent();
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new BadRequestException("Nessun payment_intent trovato per la sessione Stripe di questa prenotazione.");
        }

        Refund.create(RefundCreateParams.builder().setPaymentIntent(paymentIntentId).build());

        booking.setBookingStatus(BookingStatus.CANCELLED);
        booking.setCanceledAt(LocalDateTime.now());
        booking.setCancelReason("ADMIN_REFUND");
        booking.setExpiresAt(null);
        bookingRepository.save(booking);
        emailOutboxService.enqueueBookingRefunded(booking);

        log.info("Booking refunded and cancelled: bookingId={} stripeSession={}", bookingId, booking.getStripeSessionId());
    }

    // ============================ UPDATE (ADMIN/OWNER) ============================
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public BookingResponseDTO updateBooking(UUID bookingId, NewBookingDTO payload, User currentUser) {
        Booking found = findBookingById(bookingId);

        boolean admin = isAdmin(currentUser);
        if (!admin) {
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
        serviceItemService.assertServiceActive(serviceItem);
        LocalDateTime start = normalizeStart(payload.startTime());
        LocalDateTime end   = start.plusMinutes(serviceItem.getDurationMin());

        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);

        if (hasOverlapIncludingPaddingExcluding(found.getBookingId(), start, end)) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }

        found.setStartTime(start);
        found.setEndTime(end);
        found.setService(serviceItem);
        found.setServiceOption(option);
        found.setNotes(payload.notes());

        if (admin) {
            found.setCustomerName(safeTrim(payload.customerName(), "Nome cliente obbligatorio"));
            found.setCustomerEmail(safeTrim(payload.customerEmail(), "Email cliente obbligatoria").toLowerCase());
            found.setCustomerPhone(safeTrim(payload.customerPhone(), "Telefono cliente obbligatorio"));
            // FEATURE paddingMinutes: aggiornabile anche in edit
            if (payload.paddingMinutes() != null) {
                found.setPaddingMinutes(payload.paddingMinutes() > 0 ? payload.paddingMinutes() : null);
            }
        }

        Booking updated = bookingRepository.save(found);
        emailOutboxService.enqueueBookingConfirmed(updated);
        log.info("Booking updated: id={} status={} padding={}min", updated.getBookingId(), updated.getBookingStatus(), updated.getPaddingMinutes());
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

        if (old == newStatus) {
            log.info("Booking status update no-op: id={} status={}", bookingId, newStatus);
            return convertToDTO(found);
        }
        if (old == BookingStatus.CANCELLED) throw new BadRequestException("Prenotazione CANCELLED: non modificabile.");

        if (newStatus == BookingStatus.COMPLETED) found.setCompletedAt(LocalDateTime.now());
        if (newStatus == BookingStatus.CANCELLED) {
            found.setCanceledAt(LocalDateTime.now());
            found.setCancelReason("ADMIN_CANCEL");
            found.setExpiresAt(null);
        }
        if (newStatus == BookingStatus.NO_SHOW) {
            found.setCanceledAt(LocalDateTime.now());
            found.setCancelReason("NO_SHOW");
            try {
                String when = found.getStartTime().format(NOTIF_FMT);
                notificationService.create(
                    NotificationType.NO_SHOW,
                    "Cliente non presentata 👻",
                    found.getCustomerName() + " · " + when,
                    bookingId,
                    "BOOKING"
                );
            } catch (Exception e) {
                log.warn("Notification skipped for no-show {}: {}", bookingId, e.getMessage());
            }
        }

        boolean wasCompleted    = (old == BookingStatus.COMPLETED);
        boolean willBeCompleted = (newStatus == BookingStatus.COMPLETED);

        if (!wasCompleted && willBeCompleted)  packageCreditService.consumeSessionForBooking(found);
        else if (wasCompleted && !willBeCompleted) packageCreditService.restoreSessionForBooking(found);

        found.setBookingStatus(newStatus);
        Booking updated = bookingRepository.save(found);

        log.info("Booking status updated: id={} {} -> {} packageCredit={}",
                updated.getBookingId(), old, newStatus,
                updated.getPackageCredit() != null ? updated.getPackageCredit().getPackageCreditId() : "none");

        if (newStatus == BookingStatus.CANCELLED) {
            try {
                waitlistService.notifyNextInQueue(
                    updated.getService().getServiceId(),
                    updated.getStartTime().toLocalDate(),
                    updated.getStartTime().toLocalTime().truncatedTo(ChronoUnit.MINUTES)
                );
            } catch (Exception e) {
                log.warn("Waitlist notification skipped on status change {}: {}", bookingId, e.getMessage());
            }
        }

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

        if (!admin) {
            try {
                String when = found.getStartTime().format(NOTIF_FMT);
                notificationService.create(
                    NotificationType.BOOKING_CANCELLED,
                    "Prenotazione cancellata dal cliente ✕",
                    found.getCustomerName() + " ha cancellato · " + when,
                    found.getBookingId(),
                    "BOOKING"
                );
            } catch (Exception e) {
                log.warn("Notification skipped for cancellation {}: {}", bookingId, e.getMessage());
            }
        }

        try {
            waitlistService.notifyNextInQueue(
                found.getService().getServiceId(),
                found.getStartTime().toLocalDate(),
                found.getStartTime().toLocalTime().truncatedTo(ChronoUnit.MINUTES)
            );
        } catch (Exception e) {
            log.warn("Waitlist notification skipped for booking {}: {}", bookingId, e.getMessage());
        }
    }

    // ============================ PMU CONSENT ============================

    /**
     * Segna il consenso informato PMU come firmato per una prenotazione.
     * Solo per bookings che appartengono a servizi con consentRequired = true.
     */
    @Transactional
    public AdminBookingCardDTO signConsent(UUID bookingId) {
        Booking b = bookingRepository.findByIdWithDetails(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));

        if (b.getService() == null || !b.getService().isConsentRequired()) {
            throw new BadRequestException("Questo servizio non richiede consenso informato.");
        }

        b.setConsentSigned(true);
        b.setConsentSignedAt(LocalDateTime.now());
        Booking saved = bookingRepository.save(b);
        log.info("Consent PMU firmato: bookingId={} serviceId={}", bookingId, b.getService().getServiceId());
        return toAdminCard(saved);
    }

    /**
     * Ritorna tutte le prenotazioni future con consentRequired=true e consentSigned=false.
     * Usato dal pannello notifiche e dal badge nell'agenda.
     */
    @Transactional(readOnly = true)
    public List<AdminBookingCardDTO> findPmuUnsigned() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime future = now.plusDays(365);
        return bookingRepository.findPmuUnsignedFuture(
                        List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT),
                        now, future)
                .stream()
                .map(this::toAdminCard)
                .toList();
    }

    // ============================ ADMIN AGENDA ============================
    @Transactional(readOnly = true)
    public List<AdminBookingCardDTO> getAgendaDay(LocalDate date) {
        if (date == null) throw new BadRequestException("Data non valida.");
        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to   = date.plusDays(1).atStartOfDay();
        return bookingRepository.findAgendaRangeWithDetails(from, to).stream()
                .map(this::toAdminCard)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminBookingCardDTO> getAgendaRange(LocalDate fromDate, LocalDate toDateExclusive) {
        if (fromDate == null || toDateExclusive == null) throw new BadRequestException("Range non valido.");
        if (!fromDate.isBefore(toDateExclusive)) throw new BadRequestException("Range non valido (from < to).");
        LocalDateTime from = fromDate.atStartOfDay();
        LocalDateTime to   = toDateExclusive.atStartOfDay();
        return bookingRepository.findAgendaRangeWithDetails(from, to).stream()
                .map(this::toAdminCard)
                .toList();
    }

    // FEATURE paddingMinutes: esposto nel DTO card dell'agenda
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
                b.getStripeSessionId(),
                b.getPaddingMinutes(),  // FEATURE: buffer minuti extra
                b.getService() != null && b.getService().isConsentRequired(),
                b.isConsentSigned(),
                b.getConsentSignedAt()
        );
    }

    // ============================ HELPERS ============================

    /**
     * BUG FIX — padding overlap: controlla se [start, end) si sovrappone a un booking BLOCKING
     * considerando il buffer paddingMinutes di ciascun booking esistente.
     *
     * La finestra di ricerca viene allargata a sinistra di MAX_PADDING_MINUTES per trovare
     * anche booking il cui endTime (raw) precede start ma il cui endTime+paddingMinutes lo supera.
     * Il filtro preciso avviene in Java dopo aver acquisito il lock pessimistico.
     */
    private boolean hasOverlapIncludingPadding(LocalDateTime start, LocalDateTime end) {
        List<Booking> candidates = bookingRepository.lockOverlappingBookingsByStatuses(
                start.minusMinutes(MAX_PADDING_MINUTES), end, BLOCKING);
        return candidates.stream().anyMatch(b -> {
            int pad = (b.getPaddingMinutes() != null && b.getPaddingMinutes() > 0) ? b.getPaddingMinutes() : 0;
            LocalDateTime effectiveEnd = b.getEndTime().plusMinutes(pad);
            return b.getStartTime().isBefore(end) && effectiveEnd.isAfter(start);
        });
    }

    /**
     * Versione excluding di hasOverlapIncludingPadding: ignora il booking con id excludeId
     * (usata durante update per non far conflitto con se stesso).
     */
    private boolean hasOverlapIncludingPaddingExcluding(UUID excludeId, LocalDateTime start, LocalDateTime end) {
        List<Booking> candidates = bookingRepository.lockOverlappingBookingsByStatusesExcluding(
                excludeId, start.minusMinutes(MAX_PADDING_MINUTES), end, BLOCKING);
        return candidates.stream().anyMatch(b -> {
            int pad = (b.getPaddingMinutes() != null && b.getPaddingMinutes() > 0) ? b.getPaddingMinutes() : 0;
            LocalDateTime effectiveEnd = b.getEndTime().plusMinutes(pad);
            return b.getStartTime().isBefore(end) && effectiveEnd.isAfter(start);
        });
    }

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
        if (!option.isActive()) throw new BadRequestException("L'opzione selezionata non è attiva.");
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
                booking.getService() != null ? booking.getService().getTitle() : null
        );
    }

    private static <T> T requireNotNull(T value, String message) {
        if (value == null) throw new BadRequestException(message);
        return value;
    }
}