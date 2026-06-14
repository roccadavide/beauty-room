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
import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCreateDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.SaleEntryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.ServiceEntryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.SettlementRequestDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PackageSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PromoSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PromoLineSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.ServiceSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.SaleSummaryDTO;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.ClientPackagePaymentMode;
import daviderocca.beautyroom.enums.ClientPackageStatus;
import daviderocca.beautyroom.enums.LinkingStatus;
import daviderocca.beautyroom.enums.NotificationType;
import daviderocca.beautyroom.enums.PackageCreditStatus;
import daviderocca.beautyroom.enums.PaymentMethod;
import daviderocca.beautyroom.linking.LinkingOutcome;
import daviderocca.beautyroom.linking.UserLookupService;
import daviderocca.beautyroom.packages.BookingPackageLink;
import daviderocca.beautyroom.packages.BookingPackageLinkRepository;
import daviderocca.beautyroom.packages.ClientPackageAssignment;
import daviderocca.beautyroom.packages.ClientPackageService;
import daviderocca.beautyroom.packages.PackageInstallmentService;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentRepository;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.exceptions.UnauthorizedException;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ClosureRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import daviderocca.beautyroom.repositories.WorkingHoursRepository;
// 08.2: promotions <-> agenda wiring
import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.entities.Promotion;
import daviderocca.beautyroom.entities.BookingSale;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.repositories.BookingSaleRepository;
import daviderocca.beautyroom.repositories.PromotionRepository;
import daviderocca.beautyroom.promotions.BookingPromotionLink;
import daviderocca.beautyroom.promotions.BookingPromotionLinkItem;
import daviderocca.beautyroom.promotions.BookingPromotionLinkRepository;
import daviderocca.beautyroom.util.PricingUtils;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
    private final ClosureService closureService;
    private final AdminNotificationService notificationService;
    private final WaitlistService waitlistService;
    private final EmailOutboxService emailOutboxService;
    private final UserLookupService userLookupService;
    private final ClientPackageService clientPackageService;
    private final BookingPackageLinkRepository bookingPackageLinkRepository;
    // Phase 5d: snap "da definire" (date-less) installments onto the next appointment.
    private final PackageInstallmentService packageInstallmentService;
    // 08.2: promotions <-> agenda wiring
    private final BookingPromotionLinkRepository bookingPromotionLinkRepository;
    private final BookingSaleRepository bookingSaleRepository;
    private final ProductRepository productRepository;
    private final PromotionRepository promotionRepository;
    // Fix 14: the shared overlap check must also reject Michela's personal time
    // (mirrors the availability layer — personal_appointments, no padding, no lock).
    private final PersonalAppointmentRepository personalAppointmentRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${stripe.secret}")
    private String stripeSecretKey;

    @Value("${booking.hold.expire-minutes:12}")
    private int holdExpireMinutes;

    @Value("${app.booking.max-advance-days:150}")
    private int maxAdvanceDays;

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

    /**
     * Audit K / Fix 23: rejection outcome for the confirmation page, by bookingId (single flow).
     * Reads the entity because {@code cancelReason} is intentionally NOT on {@link BookingResponseDTO}.
     * Returns null when the booking is absent or not a paid-conflict rejection.
     */
    @Transactional(readOnly = true)
    public String rejectionOutcomeForBooking(UUID bookingId) {
        return rejectionOutcome(bookingRepository.findById(bookingId).orElse(null));
    }

    /**
     * Audit K / Fix 23: rejection outcome by Stripe session id (MULTI flow — the conflict tombstone
     * is keyed on the session). Returns null when no row exists yet (still processing) or it isn't a
     * paid-conflict rejection.
     */
    @Transactional(readOnly = true)
    public String rejectionOutcomeForSession(String stripeSessionId) {
        return rejectionOutcome(bookingRepository.findByStripeSessionId(stripeSessionId).orElse(null));
    }

    /**
     * A booking is a "rejected" paid booking only when it is CANCELLED with a PAID_CONFLICT* reason —
     * NOT for ordinary cancellations/expiries (which must keep the normal confirmation behaviour).
     * {@code "PAID_CONFLICT_REFUND_FAILED"} maps to REJECTED_REFUND_PENDING so the UI can soften the
     * refund wording when the automatic refund itself errored.
     */
    private static String rejectionOutcome(Booking b) {
        if (b == null || b.getBookingStatus() != BookingStatus.CANCELLED) return null;
        String reason = b.getCancelReason();
        if (reason == null || !reason.startsWith("PAID_CONFLICT")) return null;
        return "PAID_CONFLICT_REFUND_FAILED".equals(reason) ? "REJECTED_REFUND_PENDING" : "REJECTED";
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDTO> findBookingsForCurrentUser(User currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new UnauthorizedException("Utente non autenticato.");
        }
        return bookingRepository.findByUserIdOrLinkedUserUserIdOrderByStartTimeDesc(
                        currentUser.getUserId(), currentUser.getUserId())
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
        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);
        int effectiveDurationMin = (option != null && option.getDurationMin() != null && option.getDurationMin() > 0)
                ? option.getDurationMin()
                : serviceItem.getDurationMin();
        LocalDateTime end = start.plusMinutes(effectiveDurationMin);

        if (hasOverlapIncludingPadding(start, end)) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }
        closureService.assertNoOverlappingClosure(start, end);

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

    // ============================ PAY IN STORE CREATE (Cliente di Fiducia) ============================
    /**
     * Crea una prenotazione CONFERMATA con metodo PAY_IN_STORE (pagamento in loco).
     * Richiede che l'utente sia verificato (isVerified = true).
     * Non crea una sessione Stripe.
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public BookingResponseDTO createPayInStoreBooking(NewBookingDTO payload, User currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new daviderocca.beautyroom.exceptions.UnauthorizedException("Utente non autenticato.");
        }
        if (!currentUser.isVerified()) {
            throw new daviderocca.beautyroom.exceptions.UnauthorizedException(
                    "Solo i clienti di fiducia possono prenotare con pagamento in loco.");
        }

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());
        serviceItemService.assertServiceActive(serviceItem);

        LocalDateTime start = normalizeStart(payload.startTime());
        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);
        int effectiveDurationMin = (option != null && option.getDurationMin() != null && option.getDurationMin() > 0)
                ? option.getDurationMin()
                : serviceItem.getDurationMin();
        LocalDateTime end = start.plusMinutes(effectiveDurationMin);

        if (hasOverlapIncludingPadding(start, end)) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }
        closureService.assertNoOverlappingClosure(start, end);

        String name  = safeTrim(currentUser.getName() + " " + currentUser.getSurname(), "Nome cliente obbligatorio");
        String email = currentUser.getEmail().toLowerCase();
        String phone = safeTrim(payload.customerPhone() != null ? payload.customerPhone() : currentUser.getPhone(),
                "Telefono cliente obbligatorio");

        Booking booking = new Booking(name, email, phone, start, end, payload.notes(), serviceItem, option, currentUser);
        booking.setCreatedByAdmin(false);
        booking.setPaymentMethod(PaymentMethod.PAY_IN_STORE);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setPaidAt(null);
        booking.setStripeSessionId(null);
        booking.setExpiresAt(null);
        booking.setCanceledAt(null);
        booking.setCancelReason(null);
        booking.setCompletedAt(null);
        booking.setConsentLaser(payload.consentLaser());
        booking.setConsentPmu(payload.consentPmu());
        if (payload.consentLaser() || payload.consentPmu()) {
            booking.setConsentAt(LocalDateTime.now());
        }

        Booking saved = bookingRepository.save(booking);
        log.info("PAY_IN_STORE booking created: id={} userId={} serviceId={}", saved.getBookingId(),
                currentUser.getUserId(), serviceItem.getServiceId());

        emailOutboxService.enqueueBookingConfirmed(saved);

        try {
            String svc  = serviceItem.getTitle();
            String when = saved.getStartTime().format(NOTIF_FMT);
            notificationService.create(
                NotificationType.NEW_BOOKING,
                "Nuova prenotazione in loco 🏠",
                name + " · " + svc + " · " + when,
                saved.getBookingId(),
                "BOOKING"
            );
        } catch (Exception e) {
            log.warn("Notification skipped for PAY_IN_STORE booking {}: {}", saved.getBookingId(), e.getMessage());
        }

        Booking hydrated = bookingRepository.findByIdWithDetails(saved.getBookingId())
                .orElseThrow(() -> new daviderocca.beautyroom.exceptions.ResourceNotFoundException(saved.getBookingId()));
        return convertToDTO(hydrated);
    }

    // ============================ NO-SHOW ============================

    @Transactional
    public void markAsNoShow(UUID bookingId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));
        b.setNoShow(true);
        bookingRepository.save(b);
        log.info("Booking marked no-show: id={}", bookingId);
    }

    @Transactional
    public void markLatestNoShowForUser(UUID userId) {
        List<Booking> bookings = bookingRepository.findByUserIdOrderByStartTimeDesc(userId);
        Booking target = bookings.stream()
                .filter(b -> b.getBookingStatus() != BookingStatus.CANCELLED)
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(userId));
        target.setNoShow(true);
        bookingRepository.save(target);
        log.info("Latest booking marked no-show: userId={} bookingId={}", userId, target.getBookingId());
    }

    // ============================ MANUAL ADMIN CREATE ============================
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public BookingResponseDTO createManualConfirmedBookingAsAdmin(NewBookingDTO payload, User currentUser) {
        if (!isAdmin(currentUser)) throw new UnauthorizedException("Solo un ADMIN può creare prenotazioni manuali.");

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());
        serviceItemService.assertServiceActive(serviceItem);

        LocalDateTime start = payload.startTime().truncatedTo(ChronoUnit.MINUTES);
        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);
        int effectiveDurationMin = (option != null && option.getDurationMin() != null && option.getDurationMin() > 0)
                ? option.getDurationMin()
                : serviceItem.getDurationMin();
        LocalDateTime end = start.plusMinutes(effectiveDurationMin);

        if (hasOverlapIncludingPadding(start, end)) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }
        closureService.assertNoOverlappingClosure(start, end);

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

        // V64 (Fase 1.5): same arretrati return-notification as createMultiServiceBooking.
        // Best-effort + anti-dup 24h on the customer; no-op when customer is null.
        notifyOutstandingPaymentsForCustomer(booking.getCustomer(), booking.getCustomerName());

        Booking saved = bookingRepository.save(booking);
        log.info("Manual booking created by admin: id={} start={} end={} padding={}min packageCredit={}",
                saved.getBookingId(), saved.getStartTime(), saved.getEndTime(),
                saved.getPaddingMinutes(),
                saved.getPackageCredit() != null ? saved.getPackageCredit().getPackageCreditId() : "none");

        // Auto account-linking by client name (best-effort, never blocks booking creation)
        try {
            LinkingOutcome outcome = userLookupService.tryLink(saved.getCustomerName());
            saved.setLinkingStatus(outcome.status());
            if (outcome.user() != null) {
                saved.setLinkedUser(outcome.user());
            }
            bookingRepository.save(saved);
            log.info("Account linking for booking {}: {}", saved.getBookingId(), outcome.status());
        } catch (Exception e) {
            log.warn("Account linking failed for booking {}: {}", saved.getBookingId(), e.getMessage());
        }

        Booking hydrated = bookingRepository.findByIdWithDetails(saved.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException(saved.getBookingId()));
        return convertToDTO(hydrated);
    }

    // ============================ MULTI-SERVICE ADMIN CREATE ============================

    /**
     * Creates a confirmed booking that may combine:
     *   - Multiple catalog services (summed duration)
     *   - A free-form custom service (explicit duration)
     *   - A client package session (linked after save)
     *
     * Backward-compatible: the primary catalog service is also stored in the legacy
     * service FK so old queries and agenda views continue to work.
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public BookingResponseDTO createMultiServiceBooking(AdminBookingCreateDTO dto, User currentUser) {
        if (!isAdmin(currentUser)) throw new UnauthorizedException("Solo un ADMIN può creare prenotazioni.");

        // ── Step 1: validate at least one service source ──────────────────────
        // Phase 5a: singular→list adapter for in-person package links. The deprecated
        // dto.packageAssignmentId() is honored only when dto.packageAssignmentIds() is
        // null or empty. Once the frontend ships 5b, callers send the list directly.
        final List<UUID> assignmentIds = (dto.packageAssignmentIds() != null && !dto.packageAssignmentIds().isEmpty())
                ? dto.packageAssignmentIds()
                : (dto.packageAssignmentId() != null ? List.of(dto.packageAssignmentId()) : List.of());

        boolean useEntries    = dto.serviceEntries() != null && !dto.serviceEntries().isEmpty();
        boolean hasCatalog    = useEntries || (dto.serviceIds() != null && !dto.serviceIds().isEmpty());
        boolean hasCustom     = Boolean.TRUE.equals(dto.hasCustomService());
        boolean hasPkg        = !assignmentIds.isEmpty();
        boolean hasPkgCredit  = dto.packageCreditId() != null;
        // 08.2: a promo-only appointment (only products, or services not also added as
        // catalog lines) is valid — like packages, it may carry a null primary service.
        boolean hasPromo      = dto.promotionIds() != null && !dto.promotionIds().isEmpty();

        if (!hasCatalog && !hasCustom && !hasPkg && !hasPkgCredit && !hasPromo) {
            throw new BadRequestException(
                    "Specifica almeno un servizio, un servizio personalizzato o un pacchetto.");
        }
        if (hasCustom) {
            if (dto.customServiceName() == null || dto.customServiceName().isBlank()) {
                throw new BadRequestException("Nome servizio personalizzato obbligatorio.");
            }
            if (dto.customServiceDurationMinutes() == null || dto.customServiceDurationMinutes() < 1) {
                throw new BadRequestException("Durata servizio personalizzato obbligatoria.");
            }
        }

        // ── Step 2: resolve catalog services + validate package ───────────────
        List<ServiceItem> catalogServices = useEntries
                ? dto.serviceEntries().stream()
                        .map(e -> serviceItemService.findServiceItemById(e.serviceId()))
                        .toList()
                : (hasCatalog
                        ? dto.serviceIds().stream().map(serviceItemService::findServiceItemById).toList()
                        : List.of());

        List<ClientPackageAssignment> assignments = new ArrayList<>();
        if (hasPkg) {
            for (UUID aid : assignmentIds) {
                assignments.add(clientPackageService.validateActivePackage(aid));
            }
        }

        PackageCredit packageCredit = null;
        if (hasPkgCredit) {
            packageCredit = packageCreditService.findById(dto.packageCreditId());
            if (packageCredit.getStatus() != PackageCreditStatus.ACTIVE) {
                throw new BadRequestException("Il pacchetto online non è attivo (stato: " + packageCredit.getStatus() + ").");
            }
            if (packageCredit.getSessionsRemaining() <= 0) {
                throw new BadRequestException("Il pacchetto online non ha sedute residue.");
            }
        }

        // ── Step 2b: load promotions to attach (08.2) ─────────────────────────
        // Load active OR inactive (an admin may attach a just-ended promo). Dedupe per
        // the V65 (booking_id, promotion_id) UNIQUE constraint. findByIdWithDetails eager-
        // fetches services/products so the snapshot build below doesn't lazy-load per line.
        List<Promotion> promotions = new ArrayList<>();
        if (hasPromo) {
            for (UUID pid : dto.promotionIds().stream().distinct().toList()) {
                promotions.add(loadPromotionOrThrow(pid));
            }
        }

        // ── Step 3: calculate total duration ─────────────────────────────────
        int totalDuration;
        if (dto.customTotalDurationMin() != null && dto.customTotalDurationMin() > 0) {
            // Admin explicitly overrode total (e.g. parallel services)
            totalDuration = dto.customTotalDurationMin();
        } else {
            totalDuration = 0;
            List<ServiceEntryDTO> entries = useEntries ? dto.serviceEntries() : List.of();
            for (int i = 0; i < catalogServices.size(); i++) {
                ServiceItem svc = catalogServices.get(i);
                ServiceEntryDTO entry = (useEntries && i < entries.size()) ? entries.get(i) : null;
                Integer entryOverride = entry != null ? entry.overrideDurationMin() : null;
                if (entryOverride != null && entryOverride > 0) {
                    totalDuration += entryOverride;
                } else {
                    UUID optId = entry != null ? entry.optionId() : null;
                    int dur = svc.getDurationMin();
                    if (optId != null) {
                        ServiceOption opt = serviceOptionRepository.findById(optId).orElse(null);
                        if (opt != null && opt.getDurationMin() != null && opt.getDurationMin() > 0) {
                            dur = opt.getDurationMin();
                        }
                    }
                    totalDuration += dur;
                }
            }
            if (hasCustom) totalDuration += dto.customServiceDurationMinutes();
            if (hasPkg) {
                for (ClientPackageAssignment a : assignments) {
                    // Prefer the package's own per-session override when present and positive;
                    // only fall back to the option-then-service chain when it is null/non-positive.
                    Integer pkgSessionDuration = a.getSessionDurationMin();
                    if (pkgSessionDuration != null && pkgSessionDuration > 0) {
                        totalDuration += pkgSessionDuration;
                        continue;
                    }
                    if (a.getServiceOption() == null) continue;
                    ServiceOption pkgOption = a.getServiceOption();
                    Integer optDuration = pkgOption.getDurationMin();
                    if (optDuration != null && optDuration > 0) {
                        totalDuration += optDuration;
                    } else if (pkgOption.getService() != null && pkgOption.getService().getDurationMin() > 0) {
                        totalDuration += pkgOption.getService().getDurationMin();
                    }
                }
            }
            if (hasPkgCredit && packageCredit != null && packageCredit.getServiceOption() != null) {
                ServiceOption pcOption = packageCredit.getServiceOption();
                Integer optDuration = pcOption.getDurationMin();
                if (optDuration != null && optDuration > 0) {
                    totalDuration += optDuration;
                } else if (pcOption.getService() != null && pcOption.getService().getDurationMin() > 0) {
                    totalDuration += pcOption.getService().getDurationMin();
                }
            }
            // 08.2: promo services contribute to the COMPUTED duration (like packages).
            // The override branch above is intentionally NOT affected.
            totalDuration += sumPromoServicesDuration(promotions);
        }
        totalDuration = Math.max(totalDuration, 15);

        // ── Step 4: overlap check ─────────────────────────────────────────────
        LocalDateTime start = dto.date().atTime(dto.startTime()).truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime end   = start.plusMinutes(totalDuration);

        if (hasOverlapIncludingPadding(start, end)) {
            throw new BadRequestException("Lo slot selezionato non è disponibile.");
        }
        closureService.assertNoOverlappingClosure(start, end);

        // ── Step 5: build booking ─────────────────────────────────────────────
        // Primary FK kept for backward compat with existing agenda queries
        ServiceItem primaryService = catalogServices.isEmpty() ? null : catalogServices.get(0);
        UUID primaryOptionId = useEntries
                ? (dto.serviceEntries().get(0).optionId())
                : dto.serviceOptionId();
        ServiceOption primaryOption = (primaryService != null && primaryOptionId != null)
                ? resolveAndValidateOption(primaryOptionId, primaryService)
                : null;

        Booking booking = new Booking(
                safeTrim(dto.customerName(), "Nome cliente obbligatorio"),
                dto.customerEmail() != null ? dto.customerEmail().trim().toLowerCase() : "",
                dto.customerPhone() != null ? dto.customerPhone().trim() : "",
                start, end, dto.notes(),
                primaryService, primaryOption, null
        );

        // For the serviceEntries path, booking_services rows are inserted manually
        // (with option_id) after save — do NOT let @ManyToMany insert them here.
        if (!catalogServices.isEmpty()) {
            if (useEntries) {
                booking.setServices(new ArrayList<>()); // native INSERT handles booking_services
            } else {
                booking.setServices(new ArrayList<>(catalogServices));
            }
        }
        if (hasCustom) {
            booking.setCustomService(true);
            booking.setCustomServiceName(dto.customServiceName().trim());
            booking.setCustomServicePrice(dto.customServicePrice());
            // Phase 6e (V61): persist the per-custom-service duration so the
            // response can return it verbatim instead of inferring from total.
            booking.setCustomServiceDurationMin(dto.customServiceDurationMinutes());
            // V62: per-line paid for the custom service line.
            booking.setCustomServicePaid(Boolean.TRUE.equals(dto.customServicePaid()));
        }

        booking.setDurationMinutes(totalDuration);
        // V64: whole-appointment custom total price override (null = none).
        booking.setCustomTotalPrice(dto.customTotalPrice());
        booking.setCurrentSession(dto.currentSession());
        booking.setTotalSessions(dto.totalSessions());
        booking.setConsentLaser(dto.consentLaser());
        booking.setConsentPmu(dto.consentPmu());
        if (dto.consentLaser() || dto.consentPmu()) booking.setConsentAt(LocalDateTime.now());
        if (dto.paddingMinutes() != null && dto.paddingMinutes() > 0) booking.setPaddingMinutes(dto.paddingMinutes());

        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setPaymentMethod(PaymentMethod.PAY_IN_STORE);
        booking.setCreatedByAdmin(true);
        booking.setStripeSessionId(null);
        booking.setExpiresAt(null);
        if (Boolean.TRUE.equals(dto.paidInStore())) booking.setPaidInStore(true);
        if (hasPkgCredit && packageCredit != null) {
            booking.setPackageCredit(packageCredit);
            if (primaryOption == null && packageCredit.getServiceOption() != null) {
                booking.setServiceOption(packageCredit.getServiceOption());
            }
        }

        // Customer registry (best-effort). Prefer the explicit customerId sent by
        // the drawer (inline "Salva cliente"); null falls back to find-or-create.
        try {
            Customer customer = customerService.resolveForBooking(
                    dto.customerId(),
                    booking.getCustomerName(), booking.getCustomerPhone(),
                    booking.getCustomerEmail(), dto.notes());
            booking.setCustomer(customer);
        } catch (Exception e) {
            log.warn("Customer upsert failed for multi-service booking: {}", e.getMessage());
        }

        // V64: arretrati return-notification. If this returning customer still has
        // unpaid lines on past COMPLETED bookings, alert the admin. Best-effort
        // (the new booking is CONFIRMED, never counted by the query); anti-dup is
        // keyed on the customer (24h) so multiple same-day bookings notify once.
        notifyOutstandingPaymentsForCustomer(booking.getCustomer(), booking.getCustomerName());

        Booking saved = bookingRepository.save(booking);
        log.info("Multi-service booking created: id={} duration={}min services={} custom={} pkg={}",
                saved.getBookingId(), totalDuration, catalogServices.size(), hasCustom, hasPkg);

        // ── Step 5b: persist per-service option_id in booking_services ───────
        // V62: also persist bs.paid (mirror existing override pattern exactly —
        // booking_services has no JPA entity, so we drive it via native INSERT).
        if (useEntries) {
            entityManager.flush(); // ensure booking row is committed before FK insert
            List<ServiceEntryDTO> entries = dto.serviceEntries();
            for (int i = 0; i < entries.size(); i++) {
                ServiceEntryDTO e = entries.get(i);
                entityManager.createNativeQuery("""
                        INSERT INTO booking_services (id, booking_id, service_id, option_id, sort_order, override_duration_min, price_override, paid)
                        VALUES (gen_random_uuid(), :bookingId, :serviceId, :optionId, :sortOrder, :overrideDurationMin, :priceOverride, :paid)
                        """)
                        .setParameter("bookingId", saved.getBookingId())
                        .setParameter("serviceId", e.serviceId())
                        .setParameter("optionId", e.optionId())
                        .setParameter("sortOrder", i + 1)
                        .setParameter("overrideDurationMin", e.overrideDurationMin())
                        .setParameter("priceOverride", e.prezzoOverride())
                        .setParameter("paid", Boolean.TRUE.equals(e.paid()))
                        .executeUpdate();
            }
        }

        // ── Step 6: link / create / update package session ────────────────────
        // NOTE: linkBooking() uses REQUIRES_NEW and cannot see the uncommitted booking.
        // Use managed entities directly to stay within this SERIALIZABLE transaction.
        boolean hasSessionNumbers = dto.currentSession() != null && dto.totalSessions() != null;

        if (hasPkg) {
            // CASE C — N in-person packages may be linked at once (Phase 5a).
            // For each: validate remaining > 0, compute its own sessionNumber from its
            // own counter, create a BookingPackageLink with sessionTrackedAtCreation=true,
            // inline-decrement THAT assignment's sessionsRemaining.
            // dto.currentSession is intentionally ignored here — with N packages it would be
            // ambiguous; per-assignment computation is canonical. CASE A/B still honors it.
            for (ClientPackageAssignment a : assignments) {
                if (a.getSessionsRemaining() <= 0) {
                    throw new BadRequestException(
                            "Il pacchetto '"
                                    + (a.getCustomPackageName() != null && !a.getCustomPackageName().isBlank()
                                            ? a.getCustomPackageName() : a.getId())
                                    + "' non ha sessioni rimanenti.");
                }
            }

            // Inherit service/option from the FIRST package only — back-compat.
            // This is what makes the agenda show "Epilazione laser · Inguine" instead of empty,
            // and what makes the price/duration derivable in the legacy single-package UI.
            ClientPackageAssignment head = assignments.get(0);
            if (saved.getService() == null) {
                ServiceItem pkgService = head.getService();
                if (pkgService == null && head.getServiceOption() != null) {
                    pkgService = head.getServiceOption().getService();
                }
                if (pkgService != null) {
                    saved.setService(pkgService);
                }
            }
            if (saved.getServiceOption() == null && head.getServiceOption() != null) {
                saved.setServiceOption(head.getServiceOption());
            }

            Integer firstSessionNumber = null;
            Integer firstTotalSessions = null;
            for (ClientPackageAssignment a : assignments) {
                int sessionsUsedBefore = a.getTotalSessions() - a.getSessionsRemaining();
                int newSessionNumber = sessionsUsedBefore + 1;
                int newRemaining = Math.max(0, a.getTotalSessions() - newSessionNumber);

                BookingPackageLink pkgLink = new BookingPackageLink();
                pkgLink.setBooking(saved);
                pkgLink.setAssignment(a);
                pkgLink.setSessionNumber(newSessionNumber);
                pkgLink.setSessionTrackedAtCreation(true);
                // V62: per-session paid. Locked packages (paidUpfront) skip this:
                // the upfront flag is authoritative, the map value is ignored.
                pkgLink.setPaid(resolveLinkPaid(dto.packageSessionPaid(), a));
                bookingPackageLinkRepository.save(pkgLink);

                a.setSessionsRemaining(newRemaining);
                if (newRemaining == 0) {
                    a.setStatus(ClientPackageStatus.EXHAUSTED);
                }
                clientPackageService.saveAssignment(a);

                if (firstSessionNumber == null) {
                    firstSessionNumber = newSessionNumber;
                    firstTotalSessions = a.getTotalSessions();
                }

                log.info("CASE C: bookingId={} linked to assignmentId={} session {}/{} (remaining={})",
                        saved.getBookingId(), a.getId(),
                        newSessionNumber, a.getTotalSessions(), newRemaining);
            }

            // Populate booking.currentSession / totalSessions from the FIRST link only
            // (back-compat — agenda still reads these direct booking fields until Phase 6).
            saved.setCurrentSession(firstSessionNumber);
            saved.setTotalSessions(firstTotalSessions);
            bookingRepository.save(saved);
        } else if (hasPkgCredit) {
            // CASE D — packageCreditId provided: PackageCredit FK already set before save.
            // Session will be decremented by packageCreditService.consumeSessionForBooking()
            // when the booking is marked COMPLETED (wired in updateBookingStatus).
            log.info("CASE D: bookingId={} linked to packageCreditId={}",
                    saved.getBookingId(), packageCredit.getPackageCreditId());

        } else if (hasSessionNumbers) {
            // CASE A / CASE B — explicit session numbers provided without a preselected package.
            // Creates (or reuses) an implicit package and links the booking directly with the
            // explicit sessionNumber — no recalculate, no post-hoc override.
            final UUID primaryServiceId = (primaryService != null) ? primaryService.getServiceId() : null;
            final String primaryTitle = (primaryService != null) ? primaryService.getTitle() : null;

            // Extended match: serviceOption.service.id (legacy) OR customPackageName == primary service title.
            // This lets us reuse implicit packages created in previous runs.
            ClientPackageAssignment pkg = clientPackageService
                    .findActiveAssignmentsByClientName(saved.getCustomerName())
                    .stream()
                    .filter(a -> {
                        if (primaryServiceId != null) {
                            // Match by direct service FK (new)
                            if (a.getService() != null && a.getService().getServiceId().equals(primaryServiceId)) {
                                return true;
                            }
                            // Or via serviceOption.service.id (legacy packages with serviceOption but no service FK)
                            if (a.getServiceOption() != null
                                    && a.getServiceOption().getService() != null
                                    && a.getServiceOption().getService().getServiceId().equals(primaryServiceId)) {
                                return true;
                            }
                        }
                        // Last resort: match by customPackageName (truly custom packages or pre-migration legacy)
                        return primaryTitle != null
                                && primaryTitle.equalsIgnoreCase(a.getCustomPackageName());
                    })
                    .findFirst()
                    .orElse(null);

            if (pkg == null) {
                pkg = new ClientPackageAssignment();
                pkg.setClientName(saved.getCustomerName());
                if (primaryService != null) {
                    // Catalog service — store both service and (optional) option directly.
                    // Display name is derived from these in toDTO/toAdminCard, so we do NOT
                    // set customPackageName here.
                    pkg.setService(primaryService);
                    if (primaryOption != null) {
                        pkg.setServiceOption(primaryOption);
                    }
                } else if (saved.isCustomService() && saved.getCustomServiceName() != null) {
                    // Truly custom (free-form) name — no catalog reference
                    pkg.setCustomPackageName(saved.getCustomServiceName().trim());
                }
                log.info("CASE A: creating implicit assignment for client '{}' (service={}, option={})",
                        saved.getCustomerName(),
                        primaryService != null ? primaryService.getServiceId() : "none",
                        primaryOption != null ? primaryOption.getOptionId() : "none");
            } else {
                // Backfill service and serviceOption on legacy packages that were created without them
                boolean changed = false;
                if (pkg.getService() == null && primaryService != null) {
                    pkg.setService(primaryService);
                    changed = true;
                }
                if (pkg.getServiceOption() == null && primaryOption != null) {
                    pkg.setServiceOption(primaryOption);
                    changed = true;
                }
                if (changed) {
                    log.info("CASE B: backfilling service/option for assignmentId={} (service={}, option={})",
                            pkg.getId(),
                            primaryService != null ? primaryService.getServiceId() : "unchanged",
                            primaryOption != null ? primaryOption.getOptionId() : "unchanged");
                }
                log.info("CASE B: reusing assignmentId={} for client '{}'",
                        pkg.getId(), saved.getCustomerName());
            }

            pkg.setTotalSessions(dto.totalSessions());
            // sessionsRemaining = totalSessions − currentSession (sessions left AFTER this one)
            int remaining = Math.max(0, dto.totalSessions() - dto.currentSession());
            pkg.setSessionsRemaining(remaining);
            pkg.setStatus(remaining == 0 ? ClientPackageStatus.EXHAUSTED : ClientPackageStatus.ACTIVE);
            pkg = clientPackageService.saveAssignment(pkg);

            // Direct link with explicit sessionNumber — no recalculate, no subsequent override.
            BookingPackageLink pkgLink = new BookingPackageLink();
            pkgLink.setBooking(saved);
            pkgLink.setAssignment(pkg);
            pkgLink.setSessionNumber(dto.currentSession());
            pkgLink.setSessionTrackedAtCreation(true);
            // V62: same per-session paid resolution as CASE C.
            pkgLink.setPaid(resolveLinkPaid(dto.packageSessionPaid(), pkg));
            bookingPackageLinkRepository.save(pkgLink);

            saved.setCurrentSession(dto.currentSession());
            saved.setTotalSessions(dto.totalSessions());

            // Clear booking_services to avoid duplication "package label + standalone service" in agenda.
            entityManager.createNativeQuery(
                            "DELETE FROM booking_services WHERE booking_id = :bookingId")
                    .setParameter("bookingId", saved.getBookingId())
                    .executeUpdate();
            saved.setServices(new ArrayList<>());
            bookingRepository.save(saved);

            log.info("CASE A/B done: bookingId={} pkg={} session {}/{} remaining={}",
                    saved.getBookingId(), pkg.getId(),
                    dto.currentSession(), dto.totalSessions(), remaining);
        }

        // ── Step 6c (Phase 5d): snap "da definire" installments onto this date ──
        // The package link(s) are now persisted. Re-read them as the single source
        // for EVERY linked assignment (CASE C's N packages + CASE A/B's implicit one)
        // and pin any unpaid date-less rata to this appointment's date, so a "da
        // definire" rata resurfaces here as an ordinary dated installment. Guard:
        // never snap onto a back-dated/historical booking (today or future only).
        LocalDate snapDate = saved.getStartTime().toLocalDate();
        if (!snapDate.isBefore(LocalDate.now())) {
            List<UUID> linkedAssignmentIds = bookingPackageLinkRepository
                    .findAllByBookingBookingIdWithAssignment(saved.getBookingId())
                    .stream()
                    .map(l -> l.getAssignment().getId())
                    .distinct()
                    .toList();
            packageInstallmentService.snapDatelessInstallments(linkedAssignmentIds, snapDate);
        }

        // ── Step 6b: attach promotions (frozen snapshot + product stock −1) ────
        // Mirrors the package-link block: one BookingPromotionLink per promotion, built
        // from the 08.1 single source of truth. Promo-only keeps a null primary service.
        for (Promotion promo : promotions) {
            buildAndPersistPromotionLink(saved, promo, dto);
        }

        // ── Block B: reconcile standalone product sales (promotion_link_id IS NULL) ──
        reconcileStandaloneSales(saved.getBookingId(), dto);

        // ── Step 7: auto account-linking ──────────────────────────────────────
        try {
            LinkingOutcome outcome = userLookupService.tryLink(saved.getCustomerName());
            saved.setLinkingStatus(outcome.status());
            if (outcome.user() != null) saved.setLinkedUser(outcome.user());
            bookingRepository.save(saved);
        } catch (Exception e) {
            log.warn("Account linking failed for booking {}: {}", saved.getBookingId(), e.getMessage());
        }

        Booking hydrated = bookingRepository.findByIdWithDetails(saved.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException(saved.getBookingId()));

        // PROMPT E: agenda-created appointment → confirmation + 24h reminder (same chain as the
        // online and in-store paths). No email gate is needed here: enqueueSafe no-ops when the
        // customerEmail is null/blank, so walk-ins without an email get nothing. No double-send
        // either: the uk_email_event_agg unique guard makes the edit path's later
        // enqueueBookingConfirmed a no-op for the confirmation (it only reschedules the reminder).
        // Future gate: back-filling a PAST appointment (data entry of history) must not email the
        // client a confirmation for something already happened.
        if (hydrated.getStartTime() != null && hydrated.getStartTime().isAfter(LocalDateTime.now())) {
            emailOutboxService.enqueueBookingConfirmed(hydrated);
        }
        return convertToDTO(hydrated);
    }

    /**
     * Creates a CONFIRMED booking for a multi-service Stripe checkout after payment succeeds.
     * Called from the webhook — runs at SERIALIZABLE isolation to detect slot conflicts atomically.
     *
     * Fix 15: {@code serviceOptionIds} is index-aligned to {@code serviceIds} (a null/short entry =
     * no option for that line). Each booking_services row is written via native INSERT carrying its
     * own option_id (the @ManyToMany is suppressed), so the same service added with different options
     * persists as distinct, distinguishable rows. {@code customTotalPrice} (Fix 11) stays the
     * authoritative frozen total; per-row override_duration_min / price_override stay NULL (the render
     * resolves so.price / so.duration_min via option_id).
     *
     * @throws BadRequestException with message "CONFLICT" if the slot is already taken.
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Booking createMultiServiceBookingFromWebhook(
            List<UUID> serviceIds,
            LocalDate date,
            LocalTime startTime,
            int totalDurationMinutes,
            String customerName,
            String customerEmail,
            String customerPhone,
            String notes,
            String stripeSessionId,
            UUID promotionId,
            List<SaleEntryDTO> productSales,
            boolean consentLaser,
            boolean consentPmu,
            BigDecimal customTotalPrice,
            List<UUID> serviceOptionIds
    ) {
        LocalDateTime start = date.atTime(startTime).truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime end   = start.plusMinutes(Math.max(totalDurationMinutes, 15));

        if (hasOverlapIncludingPadding(start, end)) {
            throw new BadRequestException("CONFLICT");
        }

        List<ServiceItem> services = serviceIds.stream()
                .map(serviceItemService::findServiceItemById)
                .collect(Collectors.toList());

        ServiceItem primary = services.isEmpty() ? null : services.get(0);
        String name  = customerName != null ? customerName.trim() : "";
        String email = customerEmail != null ? customerEmail.trim().toLowerCase() : "";
        String phone = customerPhone != null ? customerPhone.trim() : "";

        // Fix 15: primary option = first non-null entry, mirrored onto bookings.service_option_id for
        // single-line render coherence. Defensive lookup — the customer already paid, so a miss
        // degrades to null instead of throwing.
        ServiceOption primaryOption = null;
        if (serviceOptionIds != null) {
            for (UUID oid : serviceOptionIds) {
                if (oid != null) {
                    primaryOption = serviceOptionRepository.findById(oid).orElse(null);
                    break;
                }
            }
        }

        Booking booking = new Booking(name, email, phone, start, end, notes, primary, primaryOption, null);
        // Fix 15: suppress the @ManyToMany — it only knows (booking_id, service_id) and would write
        // option-less rows. booking_services is populated below via native INSERT carrying option_id.
        booking.setServices(new ArrayList<>());
        booking.setDurationMinutes(totalDurationMinutes);
        // Fix 11: option-aware appointment total (services only; products are separate booking_sales).
        // Set only when the cart used at least one service option — the booking then renders as a
        // priced "bundle" at the correct total instead of re-deriving wrong base per-line prices.
        // Null for all-base carts (and promos) → behaviour unchanged.
        if (customTotalPrice != null) {
            booking.setCustomTotalPrice(customTotalPrice);
        }
        // Fix 9: persist the laser/PMU consent acknowledgment from the cart flow (was dropped before).
        booking.setConsentLaser(consentLaser);
        booking.setConsentPmu(consentPmu);
        if (consentLaser || consentPmu) booking.setConsentAt(LocalDateTime.now());
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setPaidAt(LocalDateTime.now());
        booking.setCreatedByAdmin(false);
        booking.setStripeSessionId(stripeSessionId);
        booking.setExpiresAt(null);
        booking.setCanceledAt(null);
        booking.setCancelReason(null);

        // Customer registry (best-effort)
        try {
            Customer customer = customerService.findOrCreate(name, phone, email, notes);
            booking.setCustomer(customer);
        } catch (Exception e) {
            log.warn("Customer upsert failed for multi webhook booking: {}", e.getMessage());
        }

        Booking saved = bookingRepository.save(booking);
        log.info("Multi-service webhook booking created: id={} duration={}min services={}",
                saved.getBookingId(), totalDurationMinutes, services.size());

        // Fix 15: persist per-row option_id in booking_services via native INSERT (mirrors the admin
        // path — booking_services has no JPA entity). The @ManyToMany was suppressed above, so these
        // are the only rows. Repeated serviceIds with distinct option_id therefore produce distinct,
        // distinguishable rows. override_duration_min / price_override stay NULL (the render resolves
        // so.price / so.duration_min via option_id); online cart → every line is paid.
        if (!serviceIds.isEmpty()) {
            entityManager.flush(); // booking row must exist before the FK insert
            for (int i = 0; i < serviceIds.size(); i++) {
                UUID optionId = (serviceOptionIds != null && i < serviceOptionIds.size())
                        ? serviceOptionIds.get(i) : null;
                entityManager.createNativeQuery("""
                        INSERT INTO booking_services (id, booking_id, service_id, option_id, sort_order, override_duration_min, price_override, paid)
                        VALUES (gen_random_uuid(), :bookingId, :serviceId, :optionId, :sortOrder, :overrideDurationMin, :priceOverride, :paid)
                        """)
                        .setParameter("bookingId", saved.getBookingId())
                        .setParameter("serviceId", serviceIds.get(i))
                        .setParameter("optionId", optionId)
                        .setParameter("sortOrder", i)
                        .setParameter("overrideDurationMin", null)
                        .setParameter("priceOverride", null)
                        .setParameter("paid", true)
                        .executeUpdate();
            }
        }

        // Fix 3 (mixed cart): persist the online-paid products on the freshly-saved booking, inside
        // THIS SERIALIZABLE transaction (the bookingId now exists). Promo bookings carry no products,
        // so this is a no-op for them.
        createOnlineProductSales(saved.getBookingId(), productSales);

        // 08.4: promo-only online booking — attach the frozen promo snapshot (paid online), exactly
        // like the admin path. The promo carries its services in the link snapshot, not booking_services.
        String promoTitle = null;
        if (promotionId != null) {
            Promotion promo = loadPromotionOrThrow(promotionId);
            buildAndPersistPromotionLink(saved, promo, true); // paid online
            promoTitle = promo.getTitle();
        }
        // Single display title for both admin notifications below (promo title, else primary, else fallback).
        String displayTitle = promoTitle != null ? promoTitle
                : (primary != null ? primary.getTitle()
                   : (services.isEmpty() ? "Trattamento" : services.get(0).getTitle()));

        // Notifica admin
        try {
            String when = saved.getStartTime().format(NOTIF_FMT);
            notificationService.create(
                NotificationType.NEW_BOOKING,
                "Nuova prenotazione online 🗓",
                name + " · " + displayTitle + " · " + when,
                saved.getBookingId(),
                "BOOKING"
            );
        } catch (Exception e) {
            log.warn("Notification failed for multi-service webhook booking {}: {}", saved.getBookingId(), e.getMessage());
        }

        // Closure overlap on a webhook booking: NEVER reject — the customer already
        // paid via Stripe. We honour the booking and flag it for the admin instead.
        try {
            if (closureService.hasOverlappingClosure(saved.getStartTime(), saved.getEndTime())) {
                String when = saved.getStartTime().format(NOTIF_FMT);
                notificationService.create(
                    NotificationType.BOOKING_CLOSURE_CONFLICT,
                    "⚠ Prenotazione online dentro una chiusura",
                    name + " · " + displayTitle + " · " + when + " — verifica con il cliente.",
                    saved.getBookingId(),
                    "BOOKING"
                );
                log.warn("Webhook booking {} falls inside a programmed closure", saved.getBookingId());
            }
        } catch (Exception e) {
            log.warn("Closure conflict check failed for webhook booking {}: {}", saved.getBookingId(), e.getMessage());
        }

        // Auto account-linking (best-effort)
        try {
            LinkingOutcome outcome = userLookupService.tryLink(saved.getCustomerName());
            saved.setLinkingStatus(outcome.status());
            if (outcome.user() != null) saved.setLinkedUser(outcome.user());
            bookingRepository.save(saved);
        } catch (Exception e) {
            log.warn("Account linking failed for webhook booking {}: {}", saved.getBookingId(), e.getMessage());
        }

        return saved;
    }

    /**
     * Audit K / Fix 23: persist a minimal CANCELLED tombstone for a MULTI booking that was paid but
     * rejected by the webhook (slot taken — booking-overlap race or personal-time block). The
     * SERIALIZABLE attempt in {@link #createMultiServiceBookingFromWebhook} already rolled back leaving
     * no row, so this runs in its OWN fresh transaction (committed independently). The tombstone is what
     * makes the rejection observable to the confirmation page via {@code findByStripeSessionId}.
     *
     * <p>Idempotent per Stripe session: if a row already exists for {@code stripeSessionId} (e.g. a
     * webhook retry) it is returned unchanged — no duplicate. The caller relies on the same check to
     * avoid issuing a second refund.</p>
     *
     * <p>Minimal by design: no services, no customer-registry upsert, no notifications. {@code CANCELLED}
     * means it is excluded from availability/overlap ({@code BLOCKING}), arretrati (COMPLETED-only) and
     * the active agenda timeline — exactly like the single flow's existing PAID_CONFLICT rows.</p>
     *
     * @param refundSucceeded whether the automatic Stripe refund went through — drives the cancelReason
     *                        ({@code "PAID_CONFLICT"} vs {@code "PAID_CONFLICT_REFUND_FAILED"}).
     */
    @Transactional
    public Booking recordMultiServiceConflictTombstone(
            LocalDate date,
            LocalTime startTime,
            int totalDurationMinutes,
            String customerName,
            String customerEmail,
            String customerPhone,
            String stripeSessionId,
            boolean refundSucceeded
    ) {
        // Idempotent: a row already exists for this session (retry) → no duplicate, no second refund.
        Optional<Booking> existing = bookingRepository.findByStripeSessionId(stripeSessionId);
        if (existing.isPresent()) {
            log.info("Conflict tombstone già presente per sessionId={}, skip", stripeSessionId);
            return existing.get();
        }

        LocalDateTime start = date.atTime(startTime).truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime end   = start.plusMinutes(Math.max(totalDurationMinutes, 15));
        String name  = customerName  != null ? customerName.trim() : "";
        String email = customerEmail != null ? customerEmail.trim().toLowerCase() : "";
        String phone = customerPhone != null ? customerPhone.trim() : "";

        Booking tombstone = new Booking(name, email, phone, start, end, null, null, null, null);
        tombstone.setServices(new ArrayList<>());
        tombstone.setDurationMinutes(totalDurationMinutes);
        tombstone.setBookingStatus(BookingStatus.CANCELLED);
        tombstone.setCancelReason(refundSucceeded ? "PAID_CONFLICT" : "PAID_CONFLICT_REFUND_FAILED");
        tombstone.setStripeSessionId(stripeSessionId);
        tombstone.setCanceledAt(LocalDateTime.now());
        tombstone.setExpiresAt(null);
        tombstone.setCreatedByAdmin(false);

        Booking saved = bookingRepository.save(tombstone);
        log.info("Conflict tombstone CANCELLED persistito: id={} sessionId={} reason={}",
                saved.getBookingId(), stripeSessionId, saved.getCancelReason());
        return saved;
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

        for (int i = 0; i < maxAdvanceDays; i++) {
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

            List<Closure> closures = closureRepository.findOverlappingDate(day);
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

        // FIX B3: blocca la delete solo se la prenotazione è pagata online E non è già in uno
        // stato terminale gestito. Se è CANCELLED o REFUNDED il rimborso è stato gestito (o non
        // c'era pagamento online): la delete è sempre sicura in quel caso.
        boolean isPaidOnline = found.getStripeSessionId() != null;
        boolean isCancelled  = found.getBookingStatus() == BookingStatus.CANCELLED;
        boolean isRefunded   = found.getBookingStatus() == BookingStatus.REFUNDED;

        if (isPaidOnline && !isCancelled && !isRefunded) {
            throw new BadRequestException(
                    "Questa prenotazione è stata pagata online. Gestisci prima il rimborso prima di eliminarla."
            );
        }

        // 08.2: restore promo-product stock only while the booking is still "held"
        // (PENDING_PAYMENT / CONFIRMED); COMPLETED/NO_SHOW keep stock decremented. Then purge
        // promo artifacts — sales FIRST (booking_sales.promotion_link_id is ON DELETE SET NULL).
        // MUST flush before the entityManager.clear() below: clear() discards unflushed removals,
        // and booking_sales has no FK cascade to bookings, so the promo sale rows would leak.
        BookingStatus promoSt = found.getBookingStatus();
        if (promoSt == BookingStatus.PENDING_PAYMENT || promoSt == BookingStatus.CONFIRMED) {
            restorePromoStockForBooking(found.getBookingId());
            // Block B: restore standalone-sale stock under the IDENTICAL held-only guard. A booking
            // already CANCELLED (stock restored on cancel) is excluded here → no double-restore. The
            // standalone rows themselves vanish with the booking via the booking_sales FK cascade (V15).
            restoreStandaloneSaleStock(found.getBookingId());
        }
        deleteAllPromoArtifactsForBooking(found.getBookingId());
        entityManager.flush();

        // Phase 5a: capture ALL link assignment ids before delete — every assignment
        // this booking was linked to needs its session count realigned afterwards.
        List<UUID> pkgAssignmentIds = List.of();
        try {
            pkgAssignmentIds = bookingPackageLinkRepository
                    .findAllByBookingBookingIdWithAssignment(bookingId)
                    .stream()
                    .map(l -> l.getAssignment().getId())
                    .toList();
        } catch (Exception e) {
            log.warn("Could not load package links before delete for booking {}: {}", bookingId, e.getMessage());
        }

        // Delete the links first via bulk JPQL — bypasses L1 cache entirely, goes straight to DB.
        // We cannot call bookingRepository.delete(found) while a MANAGED BookingPackageLink entity
        // still references 'found': when flush() fires Hibernate detects a MANAGED→REMOVED
        // reference and throws TransientObjectException before any SQL runs.
        entityManager.createQuery(
                        "DELETE FROM BookingPackageLink bpl WHERE bpl.booking.bookingId = :id")
                .setParameter("id", bookingId)
                .executeUpdate();

        // Wipe L1 cache: the previously loaded BookingPackageLink (and 'found') are now stale.
        // 'found' will be re-fetched fresh below.
        entityManager.clear();

        // Delete the booking through the JPA lifecycle (respects any @PreRemove callbacks).
        // L1 cache is clean — no stale link entity pointing at the about-to-be-removed booking.
        bookingRepository.deleteById(bookingId);
        bookingRepository.flush();
        log.info("Booking hard-deleted by admin: id={} unlinkedAssignments={}", bookingId, pkgAssignmentIds.size());

        // Links are now gone (cascade); recalculate each formerly-linked assignment
        // so its sessionsRemaining count picks up the freed slots.
        for (UUID assignmentId : pkgAssignmentIds) {
            try {
                clientPackageService.recalculatePackageSessions(assignmentId);
            } catch (Exception e) {
                log.warn("Package recalculate after delete failed for assignmentId={}: {}", assignmentId, e.getMessage());
            }
        }
    }

    // ============================ REFUND (ADMIN) ============================
    @Transactional
    public void refundBooking(UUID bookingId) throws StripeException {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));

        // CASE 1 — paid in store: no Stripe refund possible
        if (booking.isPaidInStore()) {
            throw new BadRequestException(
                    "Questa prenotazione è stata pagata in negozio. Il rimborso deve essere gestito manualmente.");
        }

        // CASE 2 — admin-created, never went through Stripe
        if (booking.getStripeSessionId() == null || booking.getStripeSessionId().isBlank()) {
            throw new BadRequestException(
                    "Nessun pagamento Stripe associato a questa prenotazione.");
        }

        // CASE 3 — already terminal
        BookingStatus status = booking.getBookingStatus();
        if (status == BookingStatus.REFUNDED || status == BookingStatus.CANCELLED) {
            throw new BadRequestException(
                    "Questa prenotazione è già stata rimborsata o annullata.");
        }

        Stripe.apiKey = stripeSecretKey;

        // CASE 4 — PENDING_PAYMENT: check if stripe session was actually paid
        if (status == BookingStatus.PENDING_PAYMENT) {
            Session pendingSession = Session.retrieve(booking.getStripeSessionId());
            if (!"paid".equals(pendingSession.getPaymentStatus())) {
                // Session unpaid or expired — just cancel, no refund needed
                booking.setBookingStatus(BookingStatus.CANCELLED);
                booking.setCanceledAt(LocalDateTime.now());
                booking.setCancelReason("ADMIN_CANCEL_UNPAID");
                booking.setExpiresAt(null);
                bookingRepository.save(booking);
                log.info("Booking PENDING_PAYMENT cancelled without refund: bookingId={}", bookingId);
                return;
            }
            // Fall through — webhook was missed, payment was collected → full refund below
        }

        // CASE 5 — CONFIRMED or COMPLETED (or PENDING_PAYMENT that turned out paid)
        // 60-day limit check
        if (booking.getPaidAt() != null && booking.getPaidAt().isBefore(LocalDateTime.now().minusDays(60))) {
            throw new BadRequestException(
                    "Il termine per il rimborso automatico è scaduto (60 giorni). Procedi manualmente dal pannello Stripe.");
        }

        Session stripeSession = Session.retrieve(booking.getStripeSessionId());
        String paymentIntentId = stripeSession.getPaymentIntent();
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new BadRequestException(
                    "Nessun payment_intent trovato per la sessione Stripe di questa prenotazione.");
        }

        // CASE 6 — StripeException is caught in the catch block below; DB not updated on failure
        try {
            // Fix 24: deterministic idempotency key so a re-issued refund (retry/double-click) returns
            // the same Stripe refund instead of creating a second one.
            RequestOptions refundOptions = RequestOptions.builder()
                    .setIdempotencyKey("refund:" + paymentIntentId)
                    .build();
            Refund.create(Map.of("payment_intent", paymentIntentId), refundOptions);
        } catch (StripeException e) {
            log.error("Stripe refund failed for bookingId={} paymentIntent={}: {}", bookingId, paymentIntentId, e.getMessage(), e);
            throw new BadRequestException(
                    "Errore Stripe durante il rimborso: " + e.getMessage() + ". Riprova o procedi manualmente dal pannello Stripe.");
        }

        // Stripe refund succeeded — update booking
        booking.setBookingStatus(BookingStatus.REFUNDED);
        booking.setCanceledAt(LocalDateTime.now());
        booking.setCancelReason("ADMIN_REFUND");
        booking.setExpiresAt(null);
        bookingRepository.save(booking);

        // Deactivate linked PackageCredit if present
        PackageCredit pc = booking.getPackageCredit();
        if (pc == null && booking.getStripeSessionId() != null) {
            pc = packageCreditService.findByStripeSessionId(booking.getStripeSessionId()).orElse(null);
        }
        if (pc != null) {
            packageCreditService.markAsRefunded(pc);
            log.info("PackageCredit {} marked REFUNDED for bookingId={}", pc.getPackageCreditId(), bookingId);
        }

        // PROMPT A: rimborso manuale concordato → email NEUTRA "Rimborso confermato" (con importo),
        // non la "slot occupato" (che resta solo per il vero PAID_CONFLICT nel webhook).
        emailOutboxService.enqueueBookingRefundConfirmed(booking);
        log.info("Booking rimborsato via Stripe: id={} paymentIntent={}", bookingId, paymentIntentId);
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

        UUID primaryServiceId = payload.serviceId() != null
                ? payload.serviceId()
                : (payload.serviceIds() != null && !payload.serviceIds().isEmpty()
                        ? payload.serviceIds().get(0)
                        : null);
        if (primaryServiceId == null) throw new BadRequestException("Almeno un servizio obbligatorio");

        ServiceItem serviceItem = serviceItemService.findServiceItemById(primaryServiceId);
        serviceItemService.assertServiceActive(serviceItem);
        LocalDateTime start = normalizeStart(payload.startTime());
        ServiceOption option = resolveAndValidateOption(payload.serviceOptionId(), serviceItem);
        int effectiveDurationMin = (option != null && option.getDurationMin() != null && option.getDurationMin() > 0)
                ? option.getDurationMin()
                : serviceItem.getDurationMin();
        LocalDateTime end = start.plusMinutes(effectiveDurationMin);

        if (hasOverlapIncludingPaddingExcluding(found.getBookingId(), start, end)) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo.");
        }

        LocalDateTime oldStart = found.getStartTime(); // PROMPT B: capture pre-move start before overwrite
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
            if (payload.paidInStore() != null) {
                found.setPaidInStore(payload.paidInStore());
            }
        }

        Booking updated = bookingRepository.save(found);
        maybeRecalculatePackage(bookingId);
        // PROMPT B: the confirmation was already enqueued at create (agenda/online/in-store), so we
        // do NOT re-send it on edit. On a real time change to a FUTURE slot, send "spostato" (from→to,
        // previous start persisted for the async worker); always realign the 24h reminder (no confirm).
        boolean moved = oldStart != null && updated.getStartTime() != null
                && !oldStart.equals(updated.getStartTime());
        if (moved && updated.getStartTime().isAfter(LocalDateTime.now())) {
            updated.setPreviousStartTime(oldStart);
            emailOutboxService.enqueueBookingRescheduled(updated);
        }
        emailOutboxService.enqueueBookingReminder24h(updated);
        log.info("Booking updated: id={} status={} padding={}min", updated.getBookingId(), updated.getBookingStatus(), updated.getPaddingMinutes());

        // V64 (Fase 1.5): arretrati return-notification on edit (same hook/anti-dup as create).
        // Uses the existing customer link as-is (no re-resolve); no-op when customer is null.
        notifyOutstandingPaymentsForCustomer(found.getCustomer(), found.getCustomerName());

        return convertToDTO(updated);
    }

    // ============================ UPDATE — MULTI-SERVICE (admin drawer) ============================
    /**
     * Full-featured update used by the new multi-service admin drawer.
     * Accepts AdminBookingCreateDTO so it handles catalog services, custom services,
     * and package sessions uniformly — fixing the "JSON malformato" bug caused by
     * the old endpoint expecting LocalDateTime but receiving only HH:mm.
     */
    @Transactional
    public BookingResponseDTO updateMultiServiceBooking(UUID bookingId, AdminBookingCreateDTO dto, User currentUser) {
        if (!isAdmin(currentUser)) throw new UnauthorizedException("Solo un ADMIN può modificare prenotazioni.");

        Booking found = findBookingById(bookingId);

        if (found.getBookingStatus() == BookingStatus.CANCELLED || found.getBookingStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Non puoi modificare una prenotazione già " + found.getBookingStatus());
        }

        boolean useEntries = dto.serviceEntries() != null && !dto.serviceEntries().isEmpty();
        boolean hasCatalog = useEntries || (dto.serviceIds() != null && !dto.serviceIds().isEmpty());
        boolean hasCustom  = Boolean.TRUE.equals(dto.hasCustomService());

        if (hasCustom) {
            if (dto.customServiceName() == null || dto.customServiceName().isBlank()) {
                throw new BadRequestException("Nome servizio personalizzato obbligatorio.");
            }
            if (dto.customServiceDurationMinutes() == null || dto.customServiceDurationMinutes() < 1) {
                throw new BadRequestException("Durata servizio personalizzato obbligatoria.");
            }
        }

        List<ServiceItem> catalogServices = useEntries
                ? dto.serviceEntries().stream()
                        .map(e -> serviceItemService.findServiceItemById(e.serviceId()))
                        .toList()
                : (hasCatalog
                        ? dto.serviceIds().stream().map(serviceItemService::findServiceItemById).toList()
                        : List.of());

        // 08.2b: the requested promo set is the desired FULL set (like packageAssignmentIds).
        // Load it once for the duration math (and to fail fast if an id is unknown).
        final java.util.List<java.util.UUID> reqPromoIds =
                (dto.promotionIds() != null && !dto.promotionIds().isEmpty())
                        ? dto.promotionIds().stream().distinct().toList()
                        : java.util.List.of();
        int requestedPromoDuration = 0;
        if (!reqPromoIds.isEmpty()) {
            java.util.List<Promotion> reqPromos = new java.util.ArrayList<>();
            for (java.util.UUID pid : reqPromoIds) reqPromos.add(loadPromotionOrThrow(pid));
            requestedPromoDuration = sumPromoServicesDuration(reqPromos);
        }

        // Total duration: explicit override → computed from services → keep existing
        int totalDuration;
        if (dto.customTotalDurationMin() != null && dto.customTotalDurationMin() > 0) {
            totalDuration = dto.customTotalDurationMin();
        } else if (hasCatalog || hasCustom) {
            totalDuration = 0;
            List<ServiceEntryDTO> updEntries = useEntries ? dto.serviceEntries() : List.of();
            for (int i = 0; i < catalogServices.size(); i++) {
                ServiceItem svc = catalogServices.get(i);
                ServiceEntryDTO updEntry = (useEntries && i < updEntries.size()) ? updEntries.get(i) : null;
                Integer entryOverride = updEntry != null ? updEntry.overrideDurationMin() : null;
                if (entryOverride != null && entryOverride > 0) {
                    totalDuration += entryOverride;
                } else {
                    UUID optId = updEntry != null ? updEntry.optionId() : null;
                    int dur = svc.getDurationMin();
                    if (optId != null) {
                        ServiceOption opt = serviceOptionRepository.findById(optId).orElse(null);
                        if (opt != null && opt.getDurationMin() != null && opt.getDurationMin() > 0) {
                            dur = opt.getDurationMin();
                        }
                    }
                    totalDuration += dur;
                }
            }
            if (hasCustom) totalDuration += dto.customServiceDurationMinutes();
            // 08.2b: size the slot for the REQUESTED promo set (it may change in the reconcile
            // below; under the full-set contract this equals the existing duration when unchanged).
            totalDuration += requestedPromoDuration;
        } else {
            // Package-only or no services in payload — keep existing duration, but swap the promo
            // contribution (08.2b): remove the OLD promos' snapshot duration, add the requested one.
            int base = found.getDurationMinutes() != null
                    ? found.getDurationMinutes()
                    : (int) java.time.Duration.between(found.getStartTime(), found.getEndTime()).toMinutes();
            totalDuration = base - existingPromoDuration(bookingId) + requestedPromoDuration;
        }
        totalDuration = Math.max(totalDuration, 5);

        LocalDateTime start = dto.date().atTime(dto.startTime()).truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime end   = start.plusMinutes(totalDuration);

        if (hasOverlapIncludingPaddingExcluding(found.getBookingId(), start, end)) {
            throw new BadRequestException("Lo slot selezionato non è disponibile.");
        }

        LocalDateTime oldStart = found.getStartTime(); // PROMPT B: capture pre-move start before overwrite
        found.setStartTime(start);
        found.setEndTime(end);
        found.setDurationMinutes(totalDuration);

        // Update catalog services (only if provided in payload)
        if (hasCatalog) {
            ServiceItem primary = catalogServices.get(0);
            found.setService(primary);
            UUID updPrimaryOptId = useEntries
                    ? dto.serviceEntries().get(0).optionId()
                    : dto.serviceOptionId();
            ServiceOption option = updPrimaryOptId != null
                    ? resolveAndValidateOption(updPrimaryOptId, primary)
                    : null;
            found.setServiceOption(option);
            // For the entries path, clear the JPA-managed collection so JPA deletes
            // old booking_services rows; native INSERT will add them back with option_id.
            found.setServices(useEntries ? new ArrayList<>() : new ArrayList<>(catalogServices));
        } else if (dto.serviceIds() != null || dto.serviceEntries() != null) {
            // Catalog fields were explicitly provided but empty — admin removed all
            // extras from a package+extras booking. Without this branch the old
            // booking_services rows would survive untouched in the DB.
            //
            // Native DELETE (same pattern as create CASE A/B) plus JPA collection
            // clear, then re-derive service/serviceOption from the linked package so
            // the booking falls back to a clean "package-only" display in the agenda.
            entityManager.createNativeQuery(
                            "DELETE FROM booking_services WHERE booking_id = :bookingId")
                    .setParameter("bookingId", bookingId)
                    .executeUpdate();
            found.setServices(new ArrayList<>());

            // Phase 5a: re-derive from the FIRST linked package (back-compat with the
            // single-link agenda display). Plural lookup keeps semantics identical when
            // there is exactly one link, which is the only case that hits this branch
            // in the deployed singular-link world.
            List<BookingPackageLink> existingLinksHere = bookingPackageLinkRepository
                    .findAllByBookingBookingIdWithAssignment(bookingId);
            if (!existingLinksHere.isEmpty()) {
                ClientPackageAssignment pkg = existingLinksHere.get(0).getAssignment();
                ServiceItem pkgService = pkg.getService();
                if (pkgService == null && pkg.getServiceOption() != null) {
                    pkgService = pkg.getServiceOption().getService();
                }
                if (pkgService != null) {
                    found.setService(pkgService);
                }
                found.setServiceOption(pkg.getServiceOption());
                log.info("updateMultiServiceBooking: cleared booking_services for bookingId={}, re-derived service={} option={} from headPkg={} (linksCount={})",
                        bookingId,
                        pkgService != null ? pkgService.getServiceId() : "none",
                        pkg.getServiceOption() != null ? pkg.getServiceOption().getOptionId() : "none",
                        pkg.getId(), existingLinksHere.size());
            } else {
                log.info("updateMultiServiceBooking: cleared booking_services for bookingId={} (no linked package)", bookingId);
            }
        }

        // Update custom service fields
        found.setCustomService(hasCustom);
        if (hasCustom) {
            found.setCustomServiceName(dto.customServiceName().trim());
            found.setCustomServicePrice(dto.customServicePrice());
            // Phase 6e (V61): keep the persisted custom duration in step with the
            // incoming payload. Without this the column stays stale across edits
            // and the response would fall through to the legacy inference.
            found.setCustomServiceDurationMin(dto.customServiceDurationMinutes());
            // V62: per-line paid for the custom service line.
            found.setCustomServicePaid(Boolean.TRUE.equals(dto.customServicePaid()));
        } else {
            // No custom service in the payload (removed on edit, or never present): clear
            // ALL custom fields unconditionally. Previously gated on hasCatalog, which left
            // a stale custom name/price/duration on a package-only or promo-only booking
            // after its custom line was removed — surfacing a phantom custom row in
            // buildBreakdownItems (incasso stimato + CompletionDrawer).
            found.setCustomServiceName(null);
            found.setCustomServicePrice(null);
            found.setCustomServiceDurationMin(null);
            found.setCustomServicePaid(false);
        }

        // V64: whole-appointment custom total price override (null = none).
        found.setCustomTotalPrice(dto.customTotalPrice());

        found.setNotes(dto.notes());
        found.setCustomerName(safeTrim(dto.customerName(), "Nome cliente obbligatorio"));
        if (dto.customerEmail() != null && !dto.customerEmail().isBlank()) {
            found.setCustomerEmail(dto.customerEmail().trim().toLowerCase());
        }
        if (dto.customerPhone() != null && !dto.customerPhone().isBlank()) {
            found.setCustomerPhone(dto.customerPhone().trim());
        }
        if (dto.paddingMinutes() != null) {
            found.setPaddingMinutes(dto.paddingMinutes() > 0 ? dto.paddingMinutes() : null);
        }
        if (dto.paidInStore() != null) {
            found.setPaidInStore(dto.paidInStore());
        }
        if (dto.currentSession() != null) found.setCurrentSession(dto.currentSession());
        if (dto.totalSessions() != null) found.setTotalSessions(dto.totalSessions());

        Booking updated = bookingRepository.save(found);

        // Persist per-service option_id: flush JPA deletes first, then re-insert with option_id
        // V62: also persist bs.paid (mirror the create path exactly).
        if (useEntries && hasCatalog) {
            entityManager.flush();
            List<ServiceEntryDTO> entries = dto.serviceEntries();
            for (int i = 0; i < entries.size(); i++) {
                ServiceEntryDTO e = entries.get(i);
                entityManager.createNativeQuery("""
                        INSERT INTO booking_services (id, booking_id, service_id, option_id, sort_order, override_duration_min, price_override, paid)
                        VALUES (gen_random_uuid(), :bookingId, :serviceId, :optionId, :sortOrder, :overrideDurationMin, :priceOverride, :paid)
                        """)
                        .setParameter("bookingId", updated.getBookingId())
                        .setParameter("serviceId", e.serviceId())
                        .setParameter("optionId", e.optionId())
                        .setParameter("sortOrder", i + 1)
                        .setParameter("overrideDurationMin", e.overrideDurationMin())
                        .setParameter("priceOverride", e.prezzoOverride())
                        .setParameter("paid", Boolean.TRUE.equals(e.paid()))
                        .executeUpdate();
            }
        }

        // ── Phase 5a: reconcile in-person package links (N → M) ────────────────
        // Diff existing links against the requested set; delete removed, insert added.
        // sessionsRemaining is then made canonical by recalculatePackageSessions for the
        // union of (removed ∪ added) assignment ids.
        final List<UUID> requestedAssignmentIds = (dto.packageAssignmentIds() != null && !dto.packageAssignmentIds().isEmpty())
                ? dto.packageAssignmentIds()
                : (dto.packageAssignmentId() != null ? List.of(dto.packageAssignmentId()) : List.of());

        List<BookingPackageLink> currentLinks = bookingPackageLinkRepository
                .findAllByBookingBookingIdWithAssignment(bookingId);
        java.util.Set<UUID> existingAssignmentIdSet = currentLinks.stream()
                .map(l -> l.getAssignment().getId())
                .collect(java.util.stream.Collectors.toSet());
        java.util.Set<UUID> requestedAssignmentIdSet = new java.util.HashSet<>(requestedAssignmentIds);

        java.util.Set<UUID> idsToRemove = new java.util.HashSet<>(existingAssignmentIdSet);
        idsToRemove.removeAll(requestedAssignmentIdSet);
        java.util.Set<UUID> idsToAdd = new java.util.HashSet<>(requestedAssignmentIdSet);
        idsToAdd.removeAll(existingAssignmentIdSet);

        if (!idsToRemove.isEmpty()) {
            for (UUID aid : idsToRemove) {
                entityManager.createQuery(
                                "DELETE FROM BookingPackageLink bpl " +
                                "WHERE bpl.booking.bookingId = :bid AND bpl.assignment.id = :aid")
                        .setParameter("bid", bookingId)
                        .setParameter("aid", aid)
                        .executeUpdate();
            }
            entityManager.flush();
            entityManager.clear();
            // Cache is now stale: re-fetch the booking before further work.
            found = findBookingById(bookingId);
            updated = found;
        }
        if (!idsToAdd.isEmpty()) {
            for (UUID aid : idsToAdd) {
                ClientPackageAssignment a = clientPackageService.validateActivePackage(aid);
                if (a.getSessionsRemaining() <= 0) {
                    throw new BadRequestException(
                            "Il pacchetto '"
                                    + (a.getCustomPackageName() != null && !a.getCustomPackageName().isBlank()
                                            ? a.getCustomPackageName() : a.getId())
                                    + "' non ha sessioni rimanenti.");
                }
                int sessionsUsedBefore = a.getTotalSessions() - a.getSessionsRemaining();
                BookingPackageLink pkgLink = new BookingPackageLink();
                pkgLink.setBooking(found);
                pkgLink.setAssignment(a);
                pkgLink.setSessionNumber(sessionsUsedBefore + 1);
                pkgLink.setSessionTrackedAtCreation(true);
                // V62: per-session paid for newly-added link.
                pkgLink.setPaid(resolveLinkPaid(dto.packageSessionPaid(), a));
                bookingPackageLinkRepository.save(pkgLink);
                // No inline-decrement: recalculatePackageSessions below is canonical.
            }
        }

        // V62: for links that survived the diff (existed before + still requested),
        // apply paid from the payload map so toggling "Pagato" on an existing
        // session persists without having to drop and re-create the link.
        if (dto.packageSessionPaid() != null && !dto.packageSessionPaid().isEmpty()) {
            java.util.Set<UUID> idsToSync = new java.util.HashSet<>(requestedAssignmentIdSet);
            idsToSync.retainAll(existingAssignmentIdSet);
            if (!idsToSync.isEmpty()) {
                List<BookingPackageLink> survivors = bookingPackageLinkRepository
                        .findAllByBookingBookingIdWithAssignment(bookingId);
                for (BookingPackageLink lnk : survivors) {
                    UUID aid = lnk.getAssignment().getId();
                    if (!idsToSync.contains(aid)) continue;
                    boolean newPaid = resolveLinkPaid(dto.packageSessionPaid(), lnk.getAssignment());
                    if (lnk.isPaid() != newPaid) {
                        lnk.setPaid(newPaid);
                        bookingPackageLinkRepository.save(lnk);
                    }
                }
            }
        }

        // Recalc the removed assignments explicitly — they no longer have a link on
        // THIS booking so maybeRecalculatePackage would skip them.
        for (UUID aid : idsToRemove) {
            try {
                clientPackageService.recalculatePackageSessions(aid);
            } catch (Exception e) {
                log.warn("Recalc-after-unlink failed for assignmentId={}: {}", aid, e.getMessage());
            }
        }

        // Recalc every assignment still linked to this booking (covers added + unchanged).
        maybeRecalculatePackage(bookingId);

        // ── post-reconcile cleanup (Bug C + Bug D): once the package reconcile above has run, the booking
        // may legitimately retain other content (a catalog service, a custom service, or
        // a promotion) while having NO in-person package link left. In that case the
        // booking-level session counters (echoed back by the drawer and written earlier in
        // this method) and the package-derived primary service (set in the "removed all
        // extras" branch above, never cleared once the link is gone) are stale and must be
        // reset — otherwise the agenda shows an orphan "Seduta X/Y" badge and re-prefills a
        // phantom service on the next edit. With a package still linked, none of this fires.
        {
            List<BookingPackageLink> remainingPkgLinks = bookingPackageLinkRepository
                    .findAllByBookingBookingIdWithAssignment(bookingId);
            if (remainingPkgLinks.isEmpty()) {
                boolean clearedAnything = false;
                if (found.getCurrentSession() != null) { found.setCurrentSession(null); clearedAnything = true; }
                if (found.getTotalSessions() != null)  { found.setTotalSessions(null);  clearedAnything = true; }
                // Only null the primary service when the payload itself carries no catalog
                // service — with catalog services present, the primary FK is correctly the
                // first catalog service (set in the hasCatalog branch above).
                if (!hasCatalog) {
                    if (found.getService() != null)       { found.setService(null);       clearedAnything = true; }
                    if (found.getServiceOption() != null) { found.setServiceOption(null); clearedAnything = true; }
                }
                if (clearedAnything) {
                    updated = bookingRepository.save(found);
                    log.info("updateMultiServiceBooking: no package link remains for bookingId={} -> cleared session counters{}",
                            bookingId, hasCatalog ? "" : " + dangling primary service/option");
                }
            }
        }

        // ── 08.2b: reconcile promotions (N → M) — mirrors the package reconcile above ──
        // dto.promotionIds() is the desired FULL set (NOT a delta); empty ⇒ remove all promos.
        List<BookingPromotionLink> currentPromoLinks =
                bookingPromotionLinkRepository.findAllByBookingBookingIdWithPromotion(bookingId);
        // Links whose live promotion was deleted (promotion == null) are frozen history: no
        // promotionId to match on ⇒ never removed/re-added by this id-keyed diff.
        java.util.Map<java.util.UUID, BookingPromotionLink> existingPromoById = new java.util.HashMap<>();
        for (BookingPromotionLink l : currentPromoLinks) {
            if (l.getPromotion() != null) existingPromoById.put(l.getPromotion().getPromotionId(), l);
        }
        java.util.Set<java.util.UUID> existingPromoIdSet = new java.util.HashSet<>(existingPromoById.keySet());
        java.util.Set<java.util.UUID> requestedPromoIdSet = new java.util.HashSet<>(reqPromoIds);

        java.util.Set<java.util.UUID> promoIdsToRemove = new java.util.HashSet<>(existingPromoIdSet);
        promoIdsToRemove.removeAll(requestedPromoIdSet);
        java.util.Set<java.util.UUID> promoIdsToAdd = new java.util.HashSet<>(requestedPromoIdSet);
        promoIdsToAdd.removeAll(existingPromoIdSet);

        for (java.util.UUID pid : promoIdsToRemove) {
            detachPromotionLink(bookingId, existingPromoById.get(pid)); // restore stock + delete sales + link
        }
        for (java.util.UUID pid : promoIdsToAdd) {
            Promotion promo = loadPromotionOrThrow(pid);          // managed + details for the snapshot
            buildAndPersistPromotionLink(found, promo, dto);      // snapshot + tagged sales + stock −1
        }
        // paid sync for survivors (existed ∩ requested) — no drop/recreate.
        if (dto.promotionPaid() != null && !dto.promotionPaid().isEmpty()) {
            java.util.Set<java.util.UUID> promoIdsToSync = new java.util.HashSet<>(requestedPromoIdSet);
            promoIdsToSync.retainAll(existingPromoIdSet);
            for (java.util.UUID pid : promoIdsToSync) {
                BookingPromotionLink lnk = existingPromoById.get(pid);
                boolean newPaid = resolvePromoPaid(pid, dto);
                if (lnk.isPaid() != newPaid) { lnk.setPaid(newPaid); bookingPromotionLinkRepository.save(lnk); }
            }
        }

        // ── Block B: reconcile standalone product sales (promotion_link_id IS NULL) ──
        reconcileStandaloneSales(bookingId, dto);

        // Back-compat: when the booking has exactly one link and the request resolves
        // to that same single package, honor dto.currentSession as a direct session-number
        // override (Phase 4 behaviour). With multiple links this is intentionally ignored.
        if (dto.currentSession() != null
                && existingAssignmentIdSet.size() == 1
                && requestedAssignmentIdSet.equals(existingAssignmentIdSet)) {
            found.setCurrentSession(dto.currentSession());
            bookingRepository.save(found);
            bookingPackageLinkRepository.findByBookingBookingIdWithAssignment(bookingId)
                    .ifPresent(lnk -> {
                        lnk.setSessionNumber(dto.currentSession());
                        bookingPackageLinkRepository.save(lnk);
                    });
        }
        // PROMPT B: confirmation already enqueued at create — don't re-send on edit. On a real time
        // change to a FUTURE slot, send "spostato" (from→to, previous persisted for the async worker);
        // always realign the 24h reminder (no confirmation re-send).
        boolean moved = oldStart != null && updated.getStartTime() != null
                && !oldStart.equals(updated.getStartTime());
        if (moved && updated.getStartTime().isAfter(LocalDateTime.now())) {
            updated.setPreviousStartTime(oldStart);
            emailOutboxService.enqueueBookingRescheduled(updated);
        }
        emailOutboxService.enqueueBookingReminder24h(updated);
        log.info("Multi-service booking updated: id={} start={} duration={}min custom={} pkgLinks={}->{} (added={}, removed={})",
                updated.getBookingId(), start, totalDuration, hasCustom,
                existingAssignmentIdSet.size(), requestedAssignmentIdSet.size(),
                idsToAdd.size(), idsToRemove.size());

        // V64 (Fase 1.5): arretrati return-notification on edit (same hook/anti-dup as create).
        // Uses the existing customer link as-is (no re-resolve); no-op when customer is null.
        notifyOutstandingPaymentsForCustomer(found.getCustomer(), found.getCustomerName());

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
            // 08.2: restore promo-product stock on the transition into CANCELLED.
            // old == CANCELLED already threw above (~:1726) → this never double-restores.
            restorePromoStockForBooking(bookingId);
            // Block B: same transition-guarded restore for standalone sales (rows kept).
            restoreStandaloneSaleStock(bookingId);
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
        maybeRecalculatePackage(bookingId);

        // PROMPT B: notify the customer that a FUTURE appointment was cancelled (generic, no reason).
        // Delete-first enqueue keeps this to one email even if cancelBooking also runs.
        if (newStatus == BookingStatus.CANCELLED
                && updated.getStartTime() != null
                && updated.getStartTime().isAfter(LocalDateTime.now())) {
            emailOutboxService.enqueueBookingCancelled(updated);
        }

        log.info("Booking status updated: id={} {} -> {} packageCredit={}",
                updated.getBookingId(), old, newStatus,
                updated.getPackageCredit() != null ? updated.getPackageCredit().getPackageCreditId() : "none");

        if (newStatus == BookingStatus.CANCELLED && updated.getService() != null) {
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

    // ============================ SETTLE (completion drawer) ============================

    /**
     * Registers per-line payment for an appointment (the completion drawer's
     * "what was paid" action), optionally completing it in the same call.
     *
     * DEFENSIVE LOCKSTEP — domain invariant: when the booking carries a
     * {@code customTotalPrice} it is ONE atomic payment unit ("bundle"). In that
     * case the per-line maps in the payload are IGNORED and every line is flipped
     * to the SAME value (markAllPaid, else the first toggle found, else false).
     * We never trust the client to keep a bundle's lines coherent.
     *
     * Non-bundle bookings honour the per-line maps (or markAllPaid for bulk).
     *
     * {@code alsoComplete} transitions to COMPLETED and is IDEMPOTENT: if the
     * booking is already COMPLETED nothing happens (no re-consume of package
     * sessions, completedAt preserved, no exception). The appointment's date does
     * NOT affect this logic — only its status and paid flags do (a CONFIRMED
     * booking in the past completes normally).
     *
     * booking_services has no JPA entity, so its {@code paid} flag is driven via
     * native UPDATE (mirrors the native INSERT in the create/update paths).
     */
    @Transactional
    public BookingResponseDTO settleBookingLines(UUID bookingId, SettlementRequestDTO req, User currentUser) {
        if (!isAdmin(currentUser)) throw new UnauthorizedException("Solo un ADMIN può registrare i pagamenti.");
        if (req == null) throw new BadRequestException("Payload di pagamento mancante.");

        Booking found = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));
        if (found.getBookingStatus() == BookingStatus.CANCELLED) {
            throw new BadRequestException("Prenotazione CANCELLED: non registrabile.");
        }

        boolean bundle = found.getCustomTotalPrice() != null;

        // Bug3: a single-service "principal" persisted only on bookings.service_id
        // (customer/manual single-service paths) has NO booking_services row, so its
        // paid state cannot live there — it lives on bookings.paid_in_store. Detect it
        // so the drawer toggle settles paid_in_store instead of issuing a no-op UPDATE
        // against a non-existent line. Multi-service bookings always have rows
        // (count > 0) → legacyPrincipal = false (no false positives).
        boolean legacyPrincipal = found.getService() != null && countBookingServiceRows(bookingId) == 0;

        if (bundle) {
            // Lockstep: ignore the per-line payload, flip everything together.
            boolean value = resolveBundleSettleValue(req);
            setAllServiceLinesPaid(bookingId, value);
            setAllPackageLinksPaid(bookingId, value);
            if (found.isCustomService()) found.setCustomServicePaid(value);
            // Lockstep: the legacy principal moves with the single bundle value.
            if (legacyPrincipal) found.setPaidInStore(value);
            // 08.2: promo links settle together with the bundle.
            setAllPromotionLinksPaid(bookingId, value);
        } else if (req.markAllPaid() != null) {
            // Bulk for a normal appointment.
            boolean value = req.markAllPaid();
            setAllServiceLinesPaid(bookingId, value);
            setAllPackageLinksPaid(bookingId, value);
            if (found.isCustomService()) found.setCustomServicePaid(value);
            if (legacyPrincipal) found.setPaidInStore(value);
            // 08.2: promo links settle together with mark-all-paid.
            setAllPromotionLinksPaid(bookingId, value);
        } else {
            // Per-line settle.
            if (req.servicePaid() != null) {
                req.servicePaid().forEach((serviceId, paid) ->
                        setServiceLinePaid(bookingId, serviceId, Boolean.TRUE.equals(paid)));
            }
            if (req.packageSessionPaid() != null && !req.packageSessionPaid().isEmpty()) {
                for (BookingPackageLink lnk : bookingPackageLinkRepository
                        .findAllByBookingBookingIdWithAssignment(bookingId)) {
                    ClientPackageAssignment a = lnk.getAssignment();
                    if (a == null || a.isPaidUpfront()) continue; // locked — upfront flag is authoritative
                    Boolean v = req.packageSessionPaid().get(a.getId());
                    if (v != null) {
                        lnk.setPaid(v);
                        bookingPackageLinkRepository.save(lnk);
                    }
                }
            }
            // 08.2b: per-line promo settle, keyed by promotionId (a promo attaches at most once).
            if (req.promotionPaid() != null && !req.promotionPaid().isEmpty()) {
                for (BookingPromotionLink lnk :
                        bookingPromotionLinkRepository.findAllByBookingBookingIdWithPromotion(bookingId)) {
                    if (lnk.getPromotion() == null) continue; // frozen/orphaned — no promotionId to key by
                    Boolean v = req.promotionPaid().get(lnk.getPromotion().getPromotionId());
                    if (v != null) { lnk.setPaid(v); bookingPromotionLinkRepository.save(lnk); }
                }
            }
            if (req.customServicePaid() != null && found.isCustomService()) {
                found.setCustomServicePaid(req.customServicePaid());
            }
            // The legacy principal arrives in servicePaid keyed by its catalog service_id;
            // the UPDATE above is a no-op (no row) so route the flag to paid_in_store.
            if (legacyPrincipal && req.servicePaid() != null) {
                Boolean v = req.servicePaid().get(found.getService().getServiceId());
                if (v != null) found.setPaidInStore(v);
            }
        }

        // Block B: standalone product sales. Flip booking_sales.paid for the given sale
        // ids, guarded to standalone sales of THIS booking (promotionLinkId == null) —
        // promo-linked sales settle via promotionPaid and the bundle (markAllPaid) is
        // services/packages/promos/custom only, so products are never touched there.
        // Independent of the bundle/markAllPaid branches above: a product is not part of
        // the manual bundle price. Mirrors the promotionPaid block (fetch-all-by-booking).
        if (req.salePaid() != null && !req.salePaid().isEmpty()) {
            for (BookingSale sale : bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId)) {
                if (sale.getPromotionLinkId() != null) continue; // promo line — settled via promotionPaid
                Boolean v = req.salePaid().get(sale.getId());
                if (v != null) { sale.setPaid(v); bookingSaleRepository.save(sale); }
            }
        }

        bookingRepository.save(found);

        // alsoComplete — idempotent transition to COMPLETED.
        if (req.alsoComplete() && found.getBookingStatus() != BookingStatus.COMPLETED) {
            found.setCompletedAt(LocalDateTime.now());
            packageCreditService.consumeSessionForBooking(found);
            found.setBookingStatus(BookingStatus.COMPLETED);
            bookingRepository.save(found);
            maybeRecalculatePackage(bookingId);
            log.info("settleBookingLines: booking {} completed via settle", bookingId);
        }
        // Already COMPLETED → completion is a no-op (idempotent): no re-consume,
        // completedAt untouched, no waitlist (that is a cancellation side-effect).

        return convertToDTO(found);
    }

    /** Bundle value precedence: markAllPaid → custom → first service → first package → false. */
    private boolean resolveBundleSettleValue(SettlementRequestDTO req) {
        if (req.markAllPaid() != null) return req.markAllPaid();
        if (req.customServicePaid() != null) return req.customServicePaid();
        if (req.servicePaid() != null) {
            for (Boolean v : req.servicePaid().values()) if (v != null) return v;
        }
        if (req.packageSessionPaid() != null) {
            for (Boolean v : req.packageSessionPaid().values()) if (v != null) return v;
        }
        return false;
    }

    private void setAllServiceLinesPaid(UUID bookingId, boolean value) {
        entityManager.createNativeQuery(
                        "UPDATE booking_services SET paid = :paid WHERE booking_id = :bid")
                .setParameter("paid", value)
                .setParameter("bid", bookingId)
                .executeUpdate();
    }

    /** Count of catalog lines for a booking. 0 → the principal is legacy (only on
     *  bookings.service_id, no booking_services row). Drives the paid_in_store routing
     *  in settleBookingLines. */
    private long countBookingServiceRows(UUID bookingId) {
        Object n = entityManager.createNativeQuery(
                        "SELECT count(*) FROM booking_services WHERE booking_id = :bid")
                .setParameter("bid", bookingId)
                .getSingleResult();
        return n == null ? 0L : ((Number) n).longValue();
    }

    private void setServiceLinePaid(UUID bookingId, UUID serviceId, boolean value) {
        entityManager.createNativeQuery(
                        "UPDATE booking_services SET paid = :paid WHERE booking_id = :bid AND service_id = :sid")
                .setParameter("paid", value)
                .setParameter("bid", bookingId)
                .setParameter("sid", serviceId)
                .executeUpdate();
    }

    /** Flips every editable (non-upfront) package session link of a booking. */
    private void setAllPackageLinksPaid(UUID bookingId, boolean value) {
        for (BookingPackageLink lnk : bookingPackageLinkRepository
                .findAllByBookingBookingIdWithAssignment(bookingId)) {
            if (lnk.getAssignment() != null && lnk.getAssignment().isPaidUpfront()) continue; // locked
            lnk.setPaid(value);
            bookingPackageLinkRepository.save(lnk);
        }
    }

    // ============================ PROMOTIONS (08.2) ============================

    /** Loads a promotion with its services/products eagerly fetched (snapshot needs them). */
    private Promotion loadPromotionOrThrow(UUID promotionId) {
        return promotionRepository.findByIdWithDetails(promotionId)
                .orElseThrow(() -> new ResourceNotFoundException(promotionId));
    }

    /** Per-promotion paid flag from the payload map (null map / missing key → false). */
    private boolean resolvePromoPaid(UUID promotionId, AdminBookingCreateDTO dto) {
        if (dto.promotionPaid() == null) return false;
        return Boolean.TRUE.equals(dto.promotionPaid().get(promotionId));
    }

    /** Sum the LIVE durations of the services inside the given promotions (used at create time). */
    private int sumPromoServicesDuration(List<Promotion> promotions) {
        int total = 0;
        for (Promotion promo : promotions) {
            for (ServiceItem s : promo.getServices()) {
                total += s.getDurationMin(); // primitive int — never null
            }
        }
        return total;
    }

    /** Sum the snapshotted durations of promo service-items already attached to a booking (update path). */
    private int existingPromoDuration(UUID bookingId) {
        int total = 0;
        for (BookingPromotionLink link : bookingPromotionLinkRepository.findAllByBookingBookingId(bookingId)) {
            for (BookingPromotionLinkItem it : link.getItems()) {
                Integer d = it.getDurationMinSnapshot();
                if (d != null) total += d;
            }
        }
        return total;
    }

    // 08.4: ordered promo lines + their computed bundle — single source of truth shared by the
    // frozen snapshot (admin path AND paid-online webhook) and the online Stripe amount, so the
    // charge and the persisted snapshot can never drift.
    private record PromoComputation(List<ServiceItem> services,
                                    List<Product> products,
                                    PricingUtils.PromoBundle bundle) {}

    /**
     * Deterministically order a promotion's services/products and price the WHOLE bundle via the
     * 08.1 single source of truth. Pure read of the (eagerly-fetched) promo — no persistence.
     */
    private PromoComputation computePromoComputation(Promotion promotion) {
        // deterministic order for stable item positions (services/products are Sets): name, then id.
        List<ServiceItem> svc = promotion.getServices().stream()
                .sorted(Comparator.comparing(ServiceItem::getTitle,
                            Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(s -> s.getServiceId().toString()))
                .toList();
        List<Product> prods = promotion.getProducts().stream()
                .sorted(Comparator.comparing(Product::getName,
                            Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(p -> p.getProductId().toString()))
                .toList();

        // PromoLines (promo services carry no per-line option here → optionId null).
        List<PricingUtils.PromoLine> svcLines = new ArrayList<>();
        for (ServiceItem s : svc) {
            svcLines.add(new PricingUtils.PromoLine(s.getServiceId(), null, s.getTitle(), s.getPrice(), s.getDurationMin()));
        }
        List<PricingUtils.PromoLine> prodLines = new ArrayList<>();
        for (Product p : prods) {
            prodLines.add(new PricingUtils.PromoLine(p.getProductId(), null, p.getName(), p.getPrice(), null));
        }

        // frozen bundle via the 08.1 single source of truth.
        PricingUtils.PromoBundle bundle = PricingUtils.computeMultiServicePromoBundle(
                promotion.getDiscountType(), promotion.getDiscountValue(), svcLines, prodLines);

        return new PromoComputation(svc, prods, bundle);
    }

    /**
     * Discounted bundle total for a promotion — used by the online checkout to set the Stripe
     * amount so it matches the snapshot the webhook will persist (same source as the snapshot).
     */
    public BigDecimal computePromoBundleTotal(Promotion promotion) {
        return computePromoComputation(promotion).bundle().totalDiscounted();
    }

    /**
     * Build + persist ONE frozen promo link for a booking: snapshot services as ordered link
     * items, snapshot products as tagged BookingSale rows, and decrement product stock by
     * exactly 1 each. Pricing/rounding come from the 08.1 single source of truth.
     */
    // existing signature — thin delegate (admin path), unchanged effect (per-promo paid from the payload).
    private void buildAndPersistPromotionLink(Booking booking, Promotion promotion, AdminBookingCreateDTO dto) {
        buildAndPersistPromotionLink(booking, promotion, resolvePromoPaid(promotion.getPromotionId(), dto));
    }

    // core — paid is explicit (admin toggle, OR true for a paid-online webhook booking).
    private void buildAndPersistPromotionLink(Booking booking, Promotion promotion, boolean paid) {
        PromoComputation pc = computePromoComputation(promotion);
        List<ServiceItem> svc = pc.services();
        List<Product> prods = pc.products();
        PricingUtils.PromoBundle bundle = pc.bundle();

        // link + snapshotted service items.
        BookingPromotionLink link = new BookingPromotionLink();
        link.setBooking(booking);
        link.setPromotion(promotion);
        link.setPromotionTitleSnapshot(promotion.getTitle());
        link.setDiscountTypeSnapshot(promotion.getDiscountType() == null ? "NONE" : promotion.getDiscountType().name());
        link.setDiscountValueSnapshot(promotion.getDiscountValue());
        link.setTotalOriginalSnapshot(bundle.totalOriginal());
        link.setTotalDiscountedSnapshot(bundle.totalDiscounted());
        link.setAppliedWhileActive(promotion.isCurrentlyActive());
        link.setPaid(paid);
        int pos = 0;
        for (PricingUtils.PromoLineResult r : bundle.serviceResults()) {
            BookingPromotionLinkItem it = new BookingPromotionLinkItem();
            it.setPosition(pos++);
            ServiceItem managed = svc.stream()
                    .filter(s -> s.getServiceId().equals(r.line().id()))
                    .findFirst().orElse(null);
            it.setService(managed);
            it.setServiceOption(null);
            it.setNameSnapshot(r.line().name());
            it.setOriginalPriceSnapshot(r.line().fullPrice());
            it.setDiscountedPriceSnapshot(r.discountedPrice());
            it.setDurationMinSnapshot(r.line().durationMin());
            link.addItem(it);
        }
        BookingPromotionLink savedLink = bookingPromotionLinkRepository.saveAndFlush(link); // flush → generated id

        // 5) promo PRODUCTS reuse the BookingSale table (tagged with the link); stock −1 each.
        for (PricingUtils.PromoLineResult r : bundle.productResults()) {
            Product product = prods.stream()
                    .filter(p -> p.getProductId().equals(r.line().id()))
                    .findFirst().orElse(null);
            if (product == null) continue;

            BookingSale sale = new BookingSale();
            sale.setBookingId(booking.getBookingId());
            sale.setProductId(product.getProductId());
            sale.setProductName(r.line().name());
            sale.setQuantity(1);
            sale.setUnitPrice(r.discountedPrice());
            sale.setOriginalUnitPrice(r.line().fullPrice());
            sale.setPromotionLinkId(savedLink.getId());
            // addedAt is populated by BookingSale @PrePersist — do not set here.
            bookingSaleRepository.save(sale);

            int before = product.getStock();
            if (before < 1) {
                log.warn("Promo product {} oversold on booking {}: stock {} -> {}",
                        product.getProductId(), booking.getBookingId(), before, before - 1);
            }
            product.setStock(before - 1); // ALWAYS −1 (may go negative — keeps restore symmetric)
            productRepository.save(product);
        }
    }

    /** Restore +quantity for PROMO sales only (free sales untouched). Idempotency is the caller's job. */
    private void restorePromoStockForBooking(UUID bookingId) {
        for (BookingSale sale : bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId)) {
            if (sale.getPromotionLinkId() == null) continue; // free sale → never touched
            productRepository.findById(sale.getProductId()).ifPresent(p -> {
                p.setStock(p.getStock() + sale.getQuantity());
                productRepository.save(p);
            });
        }
    }

    /** Block B: restore Product.stock for this booking's STANDALONE sales (promotion_link_id IS NULL).
     *  Promo product-lines are left to restorePromoStockForBooking. Idempotency is the caller's job —
     *  wired under the SAME guard as the promo restore so cancel-then-delete restores once, never twice. */
    private void restoreStandaloneSaleStock(UUID bookingId) {
        for (BookingSale s : bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId)) {
            if (s.getPromotionLinkId() != null) continue; // promo line → owned by restorePromoStockForBooking
            adjustProductStock(s.getProductId(), s.getQuantity(), false); // restore; tolerate missing product
        }
    }

    /** 08.2b reconcile-remove: restore +qty stock for ONE promo link's product-sales, delete those
     *  sales, then delete the link (items cascade via orphanRemoval + DB FK). */
    private void detachPromotionLink(java.util.UUID bookingId, BookingPromotionLink link) {
        java.util.UUID linkId = link.getId();
        for (BookingSale sale : bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId)) {
            if (linkId.equals(sale.getPromotionLinkId())) {
                productRepository.findById(sale.getProductId()).ifPresent(p -> {
                    p.setStock(p.getStock() + sale.getQuantity());
                    productRepository.save(p);
                });
                bookingSaleRepository.delete(sale);
            }
        }
        bookingPromotionLinkRepository.delete(link);
    }

    /**
     * Block B: reconcile STANDALONE product sales (promotion_link_id IS NULL) so they
     * match dto.saleEntries(), keyed by productId, adjusting Product.stock by the qty
     * delta. Promo product-lines are never touched here (the promo reconcile, which runs
     * before this, owns their stock). Runs inline in the booking's transaction — a plain
     * private method, never REQUIRES_NEW, so it sees the still-uncommitted booking.
     *
     * null saleEntries() -> no-op (caller omitted products; leave existing standalone
     * sales, including quick-add ones, untouched). Empty list -> remove all standalone.
     */
    private void reconcileStandaloneSales(UUID bookingId, AdminBookingCreateDTO dto) {
        if (dto.saleEntries() == null) return;

        // Desired set, merged by productId (defensive against duplicate lines).
        Map<UUID, SaleEntryDTO> desired = new LinkedHashMap<>();
        for (SaleEntryDTO e : dto.saleEntries()) {
            if (e == null || e.productId() == null) continue;
            int qty = Math.max(1, e.quantity());
            SaleEntryDTO prev = desired.get(e.productId());
            desired.put(e.productId(), prev == null
                    ? new SaleEntryDTO(e.productId(), qty, e.unitPrice(), e.paid())
                    : new SaleEntryDTO(e.productId(), prev.quantity() + qty, e.unitPrice(), e.paid()));
        }

        // Existing STANDALONE sales, grouped by productId (promo lines excluded).
        Map<UUID, List<BookingSale>> existing = bookingSaleRepository
                .findByBookingIdOrderByAddedAtDesc(bookingId).stream()
                .filter(s -> s.getPromotionLinkId() == null)
                .collect(Collectors.groupingBy(BookingSale::getProductId, LinkedHashMap::new, Collectors.toList()));

        // 1) Products no longer desired -> restore stock, delete rows.
        for (Map.Entry<UUID, List<BookingSale>> en : existing.entrySet()) {
            if (desired.containsKey(en.getKey())) continue;
            for (BookingSale s : en.getValue()) {
                adjustProductStock(s.getProductId(), s.getQuantity(), false); // restore; tolerate missing product
                bookingSaleRepository.delete(s);
            }
        }

        // 2) Desired products -> create (decrement) or update (adjust by oldTotal - new).
        LocalDateTime now = LocalDateTime.now();
        for (SaleEntryDTO want : desired.values()) {
            List<BookingSale> rows = existing.getOrDefault(want.productId(), List.of());
            if (rows.isEmpty()) {
                Product product = productRepository.findById(want.productId())
                        .orElseThrow(() -> new IllegalArgumentException("Prodotto non trovato: " + want.productId()));
                product.setStock(product.getStock() - want.quantity());
                productRepository.save(product);

                BookingSale s = new BookingSale();
                s.setBookingId(bookingId);
                s.setProductId(want.productId());
                s.setProductName(product.getName());
                s.setQuantity(want.quantity());
                s.setUnitPrice(want.unitPrice());
                s.setPaid(want.paid());
                s.setAddedAt(now);
                // promotionLinkId / originalUnitPrice stay null -> standalone, no discount tracking.
                bookingSaleRepository.save(s);
            } else {
                BookingSale keep = rows.get(0);
                int oldTotal = rows.stream().mapToInt(BookingSale::getQuantity).sum();
                for (int i = 1; i < rows.size(); i++) bookingSaleRepository.delete(rows.get(i)); // fold duplicates
                int delta = oldTotal - want.quantity(); // >0 restore, <0 decrement
                if (delta != 0) adjustProductStock(want.productId(), delta, true);
                keep.setQuantity(want.quantity());
                keep.setUnitPrice(want.unitPrice());
                keep.setPaid(want.paid());
                bookingSaleRepository.save(keep);
            }
        }
    }

    /** delta > 0 restores stock, delta < 0 decrements. failIfMissing=false tolerates a deleted product (removal path). */
    private void adjustProductStock(UUID productId, int delta, boolean failIfMissing) {
        Optional<Product> opt = productRepository.findById(productId);
        if (opt.isEmpty()) {
            if (failIfMissing) throw new IllegalArgumentException("Prodotto non trovato: " + productId);
            return;
        }
        Product p = opt.get();
        p.setStock(p.getStock() + delta);
        productRepository.save(p);
    }

    /**
     * Fix 3 (mixed cart): persists the online-paid products of a webhook booking as standalone
     * {@link BookingSale} rows and decrements {@link Product#getStock()} — mirroring the create branch
     * of {@link #reconcileStandaloneSales}. PLAIN private method (NOT @Transactional / REQUIRES_NEW):
     * it shares the caller's SERIALIZABLE transaction, so it can see the just-saved (uncommitted)
     * booking. Post-payment it NEVER rejects: a missing product or short stock is honoured (stock may
     * go negative in a race) and the admin is notified instead.
     */
    private void createOnlineProductSales(UUID bookingId, List<SaleEntryDTO> sales) {
        if (sales == null || sales.isEmpty()) return;
        for (SaleEntryDTO entry : sales) {
            if (entry == null || entry.productId() == null) continue;
            int qty = Math.max(1, entry.quantity());

            Optional<Product> opt = productRepository.findById(entry.productId());
            if (opt.isEmpty()) {
                log.warn("Online product sale: prodotto {} non trovato per booking {} — riga saltata",
                        entry.productId(), bookingId);
                notifyProductStockIssue(bookingId,
                        "Prodotto online non trovato",
                        "Un prodotto pagato online non esiste più a catalogo (id " + entry.productId()
                                + "). Riga non registrata — verifica l'ordine.");
                continue;
            }

            Product product = opt.get();
            if (product.getStock() < qty) {
                log.warn("Online product sale: stock insufficiente per '{}' (richiesti {}, disponibili {}) booking {}",
                        product.getName(), qty, product.getStock(), bookingId);
                notifyProductStockIssue(bookingId,
                        "⚠ Stock insufficiente su prodotto pagato online",
                        product.getName() + " · richiesti " + qty + ", disponibili " + product.getStock()
                                + " — verifica il magazzino.");
            }

            product.setStock(product.getStock() - qty);
            productRepository.save(product);

            BookingSale sale = new BookingSale();
            sale.setBookingId(bookingId);
            sale.setProductId(entry.productId());
            sale.setProductName(product.getName());
            sale.setQuantity(qty);
            sale.setUnitPrice(entry.unitPrice());
            sale.setPaid(true);
            // promotionLinkId / originalUnitPrice stay null -> standalone online sale, no discount tracking.
            bookingSaleRepository.save(sale);
        }
    }

    /** Best-effort admin notification for an online product-sale stock issue (mirrors the closure-conflict notify). */
    private void notifyProductStockIssue(UUID bookingId, String title, String body) {
        try {
            notificationService.create(NotificationType.BOOKING_STOCK_WARNING, title, body, bookingId, "BOOKING");
        } catch (Exception e) {
            log.warn("Stock-warning notification failed for booking {}: {}", bookingId, e.getMessage());
        }
    }

    /** Delete promo artifacts: sales FIRST (while promotion_link_id still identifies them), then links. */
    private void deleteAllPromoArtifactsForBooking(UUID bookingId) {
        for (BookingSale sale : bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId)) {
            if (sale.getPromotionLinkId() != null) {
                bookingSaleRepository.delete(sale);
            }
        }
        List<BookingPromotionLink> links = bookingPromotionLinkRepository.findAllByBookingBookingId(bookingId);
        if (!links.isEmpty()) {
            bookingPromotionLinkRepository.deleteAll(links);
        }
    }

    /** Flip every promo link of a booking to the given paid value (whole-booking settle). */
    private void setAllPromotionLinksPaid(UUID bookingId, boolean paid) {
        List<BookingPromotionLink> links = bookingPromotionLinkRepository.findAllByBookingBookingId(bookingId);
        for (BookingPromotionLink link : links) link.setPaid(paid);
        bookingPromotionLinkRepository.saveAll(links);
    }

    /**
     * V64: alerts the admin when a returning customer still has unpaid lines on
     * past COMPLETED bookings. Best-effort + anti-dup (24h, keyed on the customer).
     */
    private void notifyOutstandingPaymentsForCustomer(Customer customer, String customerName) {
        try {
            if (customer == null) return;
            // Keyed by phone (digits-only), the salon's stable id — walk-ins have a
            // phone but a generated email. Skip when no digits (would match every
            // phone-less booking). Anti-dup stays on customerId (most stable).
            String phone = customer.getPhone();
            if (phone == null || phone.replaceAll("[^0-9]", "").isEmpty()) return;
            if (!bookingRepository.existsUnsettledCompletedLinesForCustomer(phone)) return;
            notificationService.createIfNotRecent(
                    NotificationType.OUTSTANDING_PAYMENT,
                    "Pagamenti in sospeso 💰",
                    customerName + " ha pagamenti arretrati da saldare.",
                    customer.getCustomerId(),
                    "CUSTOMER",
                    LocalDateTime.now().minusHours(24)
            );
        } catch (Exception e) {
            log.warn("Outstanding-payment notification skipped: {}", e.getMessage());
        }
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
        maybeRecalculatePackage(bookingId);
        // 08.2: restore promo-product stock on cancel. Already-CANCELLED returned at the
        // top of this method (~:1978) → this runs at most once per booking.
        restorePromoStockForBooking(bookingId);
        // Block B: same once-per-booking guard restores standalone-sale stock (rows kept).
        restoreStandaloneSaleStock(bookingId);
        log.info("Booking cancelled: id={} reason={}", bookingId, found.getCancelReason());

        // PROMPT B: notify the customer that a FUTURE appointment was cancelled (generic, no reason).
        // Delete-first enqueue keeps this to one email even if updateBookingStatus also runs.
        if (found.getStartTime() != null && found.getStartTime().isAfter(LocalDateTime.now())) {
            emailOutboxService.enqueueBookingCancelled(found);
        }

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

        // 08.2: promo-only bookings have no primary service — guard before the waitlist notify.
        if (found.getService() != null) {
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

    // ============================ REMINDER WHATSAPP ============================

    @Transactional
    public LocalDateTime updateReminderSent(UUID bookingId, boolean sent) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));
        b.setReminderSentAt(sent ? LocalDateTime.now() : null);
        bookingRepository.save(b);
        return b.getReminderSentAt();
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
        List<Booking> bookings = bookingRepository.findAgendaRangeWithDetails(from, to);
        Set<String> outstanding = resolveOutstandingPhones(bookings);
        return bookings.stream()
                .map(b -> toAdminCard(b, outstanding.contains(digitsOnly(b.getCustomerPhone()))))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminBookingCardDTO> getAgendaRange(LocalDate fromDate, LocalDate toDateExclusive) {
        if (fromDate == null || toDateExclusive == null) throw new BadRequestException("Range non valido.");
        if (!fromDate.isBefore(toDateExclusive)) throw new BadRequestException("Range non valido (from < to).");
        LocalDateTime from = fromDate.atStartOfDay();
        LocalDateTime to   = toDateExclusive.atStartOfDay();
        List<Booking> bookings = bookingRepository.findAgendaRangeWithDetails(from, to);
        Set<String> outstanding = resolveOutstandingPhones(bookings);
        return bookings.stream()
                .map(b -> toAdminCard(b, outstanding.contains(digitsOnly(b.getCustomerPhone()))))
                .toList();
    }

    // V64 (Fase 2): ONE batch query for the whole agenda range — given the bookings in
    // view, return the set of normalized phones that have >=1 unsettled line on a past
    // COMPLETED booking. NEVER called per-card (that would re-introduce an N+1). The guard
    // returns Set.of() BEFORE hitting the repository so IN (:phones) is never IN ().
    private Set<String> resolveOutstandingPhones(List<Booking> bookings) {
        Set<String> phones = bookings.stream()
                .map(b -> digitsOnly(b.getCustomerPhone()))
                .filter(p -> !p.isEmpty())
                .collect(Collectors.toSet());
        if (phones.isEmpty()) return Set.of();
        return new HashSet<>(bookingRepository.findPhonesWithOutstanding(phones));
    }

    /** Digits-only phone (empty when null/no digits). Mirrors the SQL regexp_replace([^0-9]). */
    private static String digitsOnly(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    /** Non-agenda callers (findPmuUnsigned, signConsent): no arretrati badge. */
    private AdminBookingCardDTO toAdminCard(Booking b) {
        return toAdminCard(b, false);
    }

    /**
     * Email-layer reuse: assemble the SAME full booking card the admin agenda renders,
     * so transactional emails total a booking identically to the agenda card. Thin
     * delegator to the no-arg {@link #toAdminCard(Booking)} (no arretrati badge) — keeps
     * the EntityManager/repos/clientPackageService wiring inside BookingService. Must be
     * called inside an open transaction (the email outbox worker runs REQUIRES_NEW).
     */
    public AdminBookingCardDTO assembleBookingCard(Booking b) {
        return toAdminCard(b);
    }

    /**
     * 1-based session number of a credit-backed (online prepaid package) booking, derived by
     * ranking every booking that shares the same {@link PackageCredit} by startTime. Mirrors
     * {@code ClientPackageService.recalculatePackageSessions}: CANCELLED / NO_SHOW bookings do
     * not count. Returns 0 when {@code b} is not credit-backed or isn't found in the filtered
     * list (the email render then falls back to "N sedute · M rimanenti").
     * Used by {@link daviderocca.beautyroom.email.templates.BookingEmailAssembler} to show
     * "Seduta X di N" for online packages, just like admin ones.
     */
    public int packageSessionNumber(Booking b) {
        if (b == null || b.getPackageCredit() == null
                || b.getPackageCredit().getPackageCreditId() == null) return 0;
        List<Booking> siblings = bookingRepository
                .findByPackageCredit_PackageCreditIdOrderByStartTimeAsc(
                        b.getPackageCredit().getPackageCreditId());
        int rank = 0;
        for (Booking sib : siblings) {
            BookingStatus s = sib.getBookingStatus();
            if (s == BookingStatus.CANCELLED || s == BookingStatus.NO_SHOW) continue;
            rank++;
            if (sib.getBookingId() != null && sib.getBookingId().equals(b.getBookingId())) {
                return rank;
            }
        }
        return 0;
    }

    /**
     * Per-line service summaries for a booking, read from the booking_services join table so each
     * row carries its own option_id → option name, per-line duration/price overrides and paid flag.
     * The @ManyToMany Booking.services maps only (booking_id, service_id) and cannot surface these,
     * so both the agenda card (toAdminCard) and the booking response (convertToDTO) resolve lines here.
     */
    @SuppressWarnings("unchecked")
    private List<ServiceSummaryDTO> loadServiceSummaries(UUID bookingId) {
        List<Object[]> svcRows = entityManager.createNativeQuery("""
                SELECT bs.service_id, s.title,
                       COALESCE(bs.override_duration_min, so.duration_min, s.duration_min) AS duration_min,
                       COALESCE(bs.price_override, so.price, s.price) AS price,
                       bs.option_id, so.name AS option_name,
                       bs.override_duration_min, bs.price_override,
                       bs.paid
                FROM booking_services bs
                JOIN services s ON s.service_id = bs.service_id
                LEFT JOIN service_options so ON so.option_id = bs.option_id
                WHERE bs.booking_id = :bookingId
                ORDER BY bs.sort_order
                """)
                .setParameter("bookingId", bookingId)
                .getResultList();
        return svcRows.stream()
                .map(r -> {
                    UUID sId = r[0] instanceof UUID u ? u : UUID.fromString(r[0].toString());
                    UUID oId = r[4] == null ? null : (r[4] instanceof UUID u ? u : UUID.fromString(r[4].toString()));
                    Integer overrideDur = r[6] != null ? ((Number) r[6]).intValue() : null;
                    BigDecimal priceOvr = r[7] instanceof BigDecimal bd ? bd : (r[7] != null ? new BigDecimal(r[7].toString()) : null);
                    boolean paid = r[8] != null && (Boolean) r[8];
                    return new ServiceSummaryDTO(
                            sId,
                            (String) r[1],
                            r[2] != null ? ((Number) r[2]).intValue() : 0,
                            r[3] instanceof BigDecimal bd ? bd : (r[3] != null ? new BigDecimal(r[3].toString()) : null),
                            oId,
                            (String) r[5],
                            overrideDur,
                            priceOvr,
                            paid
                    );
                })
                .toList();
    }

    private AdminBookingCardDTO toAdminCard(Booking b, boolean hasOutstanding) {
        var pkg = b.getPackageCredit();

        // Resolve display service title: primary FK takes precedence, fall back to first in list
        String serviceTitle = null;
        UUID serviceId = null;
        if (b.getService() != null) {
            serviceTitle = b.getService().getTitle();
            serviceId = b.getService().getServiceId();
        } else if (b.isCustomService()) {
            serviceTitle = b.getCustomServiceName();
        } else if (!b.getServices().isEmpty()) {
            serviceTitle = b.getServices().get(0).getTitle();
            serviceId = b.getServices().get(0).getServiceId();
        }

        // Per-line option/override/paid resolved from booking_services (see loadServiceSummaries).
        List<ServiceSummaryDTO> services = loadServiceSummaries(b.getBookingId());

        boolean consentRequired = (b.getService() != null && b.getService().isConsentRequired())
                || services.stream().anyMatch(s -> false); // service-level consent flag not on summary

        // Phase 5a: load ALL in-person package links for this booking. Singular
        // `linkedPkg` is preserved as the first link for legacy frontend (= null when none).
        // `linkedPkgs` carries every link so the new UI can render N "Seduta X/Y" badges.
        // `linkSessionNumber` / `linkTotalSessions` continue to mirror the FIRST link
        // (back-compat — agenda still reads these direct booking fields until Phase 6).
        Integer linkSessionNumber   = null;
        Integer linkTotalSessions   = null;
        PackageSummaryDTO linkedPkg = null;
        List<PackageSummaryDTO> linkedPkgs = List.of();
        try {
            List<BookingPackageLink> links = bookingPackageLinkRepository
                    .findAllByBookingBookingIdWithAssignment(b.getBookingId());
            if (!links.isEmpty()) {
                BookingPackageLink first = links.get(0);
                if (first.getSessionNumber() > 0) linkSessionNumber = first.getSessionNumber();
                linkTotalSessions = first.getAssignment().getTotalSessions();
                linkedPkgs = links.stream()
                        .map(this::buildPackageSummary)
                        .toList();
                linkedPkg = linkedPkgs.get(0);
            }
        } catch (Exception e) {
            log.warn("Could not resolve linkedPackages for booking {}: {}", b.getBookingId(), e.getMessage());
        }

        // BE-2: fetch the booking's sales ONCE. Standalone sales (promotionLinkId == null)
        // become linkedSales; promo-tagged sales feed the linkedPromotions grouping below.
        List<BookingSale> allSales = bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(b.getBookingId());
        List<SaleSummaryDTO> linkedSales = allSales.stream()
                .filter(s -> s.getPromotionLinkId() == null)   // standalone only; promo product-lines stay inside linkedPromotions
                .map(s -> new SaleSummaryDTO(
                        s.getId(), s.getProductId(), s.getProductName(),
                        s.getQuantity(), s.getUnitPrice(), s.isPaid()))
                .toList();

        // Phase 08.3: expose promotions frozen onto this booking (snapshot + tagged product-sales).
        List<PromoSummaryDTO> linkedPromotions = List.of();
        try {
            List<BookingPromotionLink> promoLinks = bookingPromotionLinkRepository
                    .findAllByBookingBookingIdWithPromotion(b.getBookingId());
            if (!promoLinks.isEmpty()) {
                Map<UUID, List<BookingSale>> salesByLink = allSales.stream()
                        .filter(s -> s.getPromotionLinkId() != null)
                        .collect(Collectors.groupingBy(BookingSale::getPromotionLinkId));
                linkedPromotions = promoLinks.stream()
                        .map(link -> buildPromoSummary(link, salesByLink.getOrDefault(link.getId(), List.of())))
                        .toList();
            }
        } catch (Exception e) {
            log.warn("Could not resolve linkedPromotions for booking {}: {}", b.getBookingId(), e.getMessage());
        }

        // Custom service duration. Phase 6e (V61) added a persisted column on the
        // booking — when present we return it verbatim (eliminates the Phase 6e
        // Bug 1 "every edit doubles the duration" loop, which was caused by the
        // legacy total-minus-catalog inference not subtracting linked-package
        // contributions). Pre-V61 rows have NULL → fall back to the legacy
        // best-effort inference so they still render plausibly.
        Integer customServiceDurationMinutes = null;
        if (b.isCustomService()) {
            if (b.getCustomServiceDurationMin() != null && b.getCustomServiceDurationMin() > 0) {
                customServiceDurationMinutes = b.getCustomServiceDurationMin();
            } else {
                int catalogTotal = b.getServices().stream().mapToInt(ServiceItem::getDurationMin).sum();
                int raw = (b.getDurationMinutes() != null ? b.getDurationMinutes() : 0) - catalogTotal;
                customServiceDurationMinutes = raw > 0 ? raw : (b.getDurationMinutes() != null ? b.getDurationMinutes() : 60);
            }
        }

        boolean paidOnline = b.getStripeSessionId() != null && !b.isPaidInStore();
        boolean refundable = paidOnline
                && b.getBookingStatus() != BookingStatus.CANCELLED
                && b.getBookingStatus() != BookingStatus.REFUNDED
                && (b.getPaidAt() == null
                        || b.getPaidAt().isAfter(LocalDateTime.now().minusDays(60)));

        return new AdminBookingCardDTO(
                b.getBookingId(),
                b.getStartTime(),
                b.getEndTime(),
                b.getBookingStatus(),
                b.getCustomerName(),
                b.getCustomerPhone(),
                b.getCustomerEmail(),
                serviceTitle,
                serviceId,
                b.getServiceOption() != null ? b.getServiceOption().getName() : null,
                b.getServiceOption() != null ? b.getServiceOption().getOptionId() : null,
                b.getServiceOption() != null ? b.getServiceOption().getDurationMin() : null,
                b.getServiceOption() != null ? b.getServiceOption().getPrice() : null,
                b.getNotes(),
                pkg != null ? pkg.getPackageCreditId() : null,
                pkg != null ? pkg.getSessionsRemaining() : null,
                pkg != null ? pkg.getSessionsTotal() : null,
                pkg != null ? pkg.getStatus() : null,
                b.getStripeSessionId(),
                b.getPaddingMinutes(),
                consentRequired,
                b.isConsentSigned(),
                b.getConsentSignedAt(),
                services,
                b.isCustomService(),
                b.getCustomServiceName(),
                customServiceDurationMinutes,
                b.getCustomServicePrice(),
                b.getCustomTotalPrice(),
                linkSessionNumber != null ? linkSessionNumber : b.getCurrentSession(),
                linkTotalSessions != null ? linkTotalSessions : b.getTotalSessions(),
                b.getLinkedUser() != null ? b.getLinkedUser().getUserId() : null,
                b.getLinkingStatus() != null ? b.getLinkingStatus().name() : null,
                linkedPkg,
                linkedPkgs,
                b.isPaidInStore(),
                b.isCustomServicePaid(),
                b.getPaidAt(),
                paidOnline,
                refundable,
                b.getReminderSentAt(),
                hasOutstanding,
                linkedPromotions,
                linkedSales,
                b.isCreatedByAdmin(),
                // Verified account: online bookings carry it in user, Michela-created
                // auto-linked ones in linkedUser — the OR covers both.
                (b.getUser() != null && b.getUser().isVerified())
                        || (b.getLinkedUser() != null && b.getLinkedUser().isVerified())
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
        }) || overlapsPersonalAppointment(start, end);
    }

    /**
     * Fix 14 — personal-time overlap. Mirrors the availability predicate exactly
     * (AvailabilityService.getCombinedAvailabilities / getAvailableSlots): half-open
     * overlap, NO padding (personal time has none), single-day query keyed on the
     * booking's start date. No pessimistic lock: personal appointments are
     * admin-managed and not part of the customer-checkout race the booking lock guards.
     */
    private boolean overlapsPersonalAppointment(LocalDateTime start, LocalDateTime end) {
        return personalAppointmentRepository
                .findByAppointmentDateOrderByStartTime(start.toLocalDate())
                .stream()
                .anyMatch(pa -> {
                    LocalDateTime paStart = pa.getAppointmentDate().atTime(pa.getStartTime());
                    LocalDateTime paEnd   = paStart.plusMinutes(pa.getDurationMinutes());
                    return paStart.isBefore(end) && start.isBefore(paEnd);
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
        }) || overlapsPersonalAppointment(start, end);
        // No exclusion needed for personal time: a PersonalAppointment is never the
        // Booking being rescheduled, so the reschedule twin reuses the same probe.
    }

    private LocalDateTime normalizeStart(LocalDateTime startTime) {
        LocalDateTime start = requireNotNull(startTime, "La data e ora di inizio non può essere nulla")
                .truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES);
        if (start.isBefore(now)) throw new BadRequestException("L'orario di inizio non può essere nel passato.");
        if (start.toLocalDate().isAfter(LocalDate.now(AvailabilityService.BUSINESS_ZONE).plusDays(maxAdvanceDays)))
            throw new BadRequestException("Non è possibile prenotare con più di " + maxAdvanceDays + " giorni di anticipo.");
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

    /**
     * For every in-person package link this booking participates in, triggers a
     * full recalculation of that assignment's session counts. Phase 5a: extended
     * from singular to plural. Best-effort — never propagates exceptions.
     */
    private void maybeRecalculatePackage(UUID bookingId) {
        try {
            bookingPackageLinkRepository.findAllByBookingBookingIdWithAssignment(bookingId)
                    .forEach(link -> {
                        try {
                            clientPackageService.recalculatePackageSessions(link.getAssignment().getId());
                        } catch (Exception inner) {
                            log.warn("recalc failed for assignmentId={} (bookingId={}): {}",
                                    link.getAssignment().getId(), bookingId, inner.getMessage());
                        }
                    });
        } catch (Exception e) {
            log.warn("maybeRecalculatePackage failed for bookingId={}: {}", bookingId, e.getMessage());
        }
    }

    /**
     * Builds a {@link PackageSummaryDTO} for one assignment, applying the unified
     * display-name resolution (admin-entered customPackageName wins) and the
     * Phase 5a paidUpfront rule: when the assignment was paid in full upfront,
     * the per-session price reported to the agenda is zero — so paid-upfront
     * sessions don't double-count in the day's estimated revenue KPI.
     * <p>
     * The link carries this booking's session position AND (V62) the per-session
     * paid flag — different links on the same assignment can be paid independently.
     */
    private PackageSummaryDTO buildPackageSummary(BookingPackageLink link) {
        ClientPackageAssignment a = link.getAssignment();
        ServiceItem pkgSvc = a.getService() != null
                ? a.getService()
                : (a.getServiceOption() != null ? a.getServiceOption().getService() : null);
        String pkgName;
        if (a.getCustomPackageName() != null && !a.getCustomPackageName().isBlank()) {
            pkgName = a.getCustomPackageName();
        } else if (a.getServiceOption() != null && pkgSvc != null) {
            pkgName = pkgSvc.getTitle() + " · " + a.getServiceOption().getName();
        } else if (a.getServiceOption() != null) {
            pkgName = a.getServiceOption().getName();
        } else if (pkgSvc != null) {
            pkgName = pkgSvc.getTitle();
        } else {
            pkgName = "Trattamento";
        }
        ClientPackagePaymentMode mode = a.getPaymentMode();
        boolean paidLocked = a.isPaidUpfront();
        boolean paid = paidLocked || link.isPaid();
        // Zero the per-session price whenever the package is NOT billed per session:
        // UPFRONT (already locked/prepaid) or INSTALLMENTS (money tracked in the
        // installment registry). Either way the session must not count toward the
        // booking's per-session "still to collect" / estimated revenue.
        boolean nonPerSessionBilled = paidLocked || mode == ClientPackagePaymentMode.INSTALLMENTS;
        BigDecimal sessionPrice = nonPerSessionBilled
                ? BigDecimal.ZERO
                : clientPackageService.computeSessionPrice(a);
        return new PackageSummaryDTO(
                a.getId(),
                pkgName,
                link.getSessionNumber(),
                a.getTotalSessions(),
                a.getSessionsRemaining(),
                sessionPrice,
                a.isPaidUpfront(),
                clientPackageService.mapItemsToSummary(a),
                paid,
                paidLocked,
                a.getNotes(),
                mode);
    }

    /**
     * Phase 08.3: build the agenda-card summary of one promotion frozen onto a booking.
     * Service lines come from the link's ordered snapshot items; product lines come from
     * the BookingSale rows already tagged with this link (promotionLinkId). Display-only —
     * every value is the frozen snapshot; the live promotion FK is read solely to expose
     * promotionId (null when the promo was deleted after attach).
     */
    private PromoSummaryDTO buildPromoSummary(BookingPromotionLink link, List<BookingSale> linkSales) {
        List<PromoLineSummaryDTO> services = link.getItems().stream()
                .map(it -> new PromoLineSummaryDTO(
                        it.getService() != null ? it.getService().getServiceId() : null,
                        it.getNameSnapshot(),
                        it.getOriginalPriceSnapshot(),
                        it.getDiscountedPriceSnapshot(),
                        it.getDurationMinSnapshot()))
                .toList();
        List<PromoLineSummaryDTO> products = linkSales.stream()
                .map(s -> new PromoLineSummaryDTO(
                        s.getProductId(),
                        s.getProductName(),
                        s.getOriginalUnitPrice(),
                        s.getUnitPrice(),
                        null))
                .toList();
        return new PromoSummaryDTO(
                link.getPromotion() != null ? link.getPromotion().getPromotionId() : null,
                link.getId(),
                link.getPromotionTitleSnapshot(),
                link.getDiscountTypeSnapshot(),
                link.getDiscountValueSnapshot(),
                link.getTotalOriginalSnapshot(),
                link.getTotalDiscountedSnapshot(),
                link.isPaid(),
                link.isAppliedWhileActive(),
                services,
                products);
    }

    /**
     * V62: resolves the paid flag for a per-session BookingPackageLink from the
     * admin payload's packageSessionPaid map. Locked packages (paidUpfront) are
     * always treated as settled — the map value is ignored to keep the upfront
     * flag authoritative.
     */
    private boolean resolveLinkPaid(java.util.Map<UUID, Boolean> map, ClientPackageAssignment a) {
        if (a.isPaidUpfront()) return true;
        if (map == null) return false;
        return Boolean.TRUE.equals(map.get(a.getId()));
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
        // Per-line option/override/paid live only in booking_services — the @ManyToMany
        // Booking.services maps just (booking_id, service_id). Resolve from the same source
        // the agenda card uses so the confirmation page can render each line's option inline.
        List<ServiceSummaryDTO> services = loadServiceSummaries(booking.getBookingId());

        // Fallback service title for backward compat
        String serviceTitle = booking.getService() != null
                ? booking.getService().getTitle()
                : (booking.isCustomService() ? booking.getCustomServiceName() : null);

        PackageSummaryDTO linkedPackage = null;
        try {
            linkedPackage = bookingPackageLinkRepository
                    .findByBookingBookingIdWithAssignment(booking.getBookingId())
                    .map(this::buildPackageSummary)
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Could not resolve package summary for booking {}: {}", booking.getBookingId(), e.getMessage());
        }

        // Standalone product sales (promotionLinkId == null), same mapping the agenda card uses.
        // Promo product-lines stay inside their promotion grouping, not here.
        List<SaleSummaryDTO> sales = bookingSaleRepository
                .findByBookingIdOrderByAddedAtDesc(booking.getBookingId()).stream()
                .filter(s -> s.getPromotionLinkId() == null)
                .map(s -> new SaleSummaryDTO(s.getId(), s.getProductId(), s.getProductName(),
                        s.getQuantity(), s.getUnitPrice(), s.isPaid()))
                .toList();

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
                booking.getServiceOption() != null ? booking.getServiceOption().getName() : null,
                booking.getUser() != null ? booking.getUser().getUserId() : null,
                serviceTitle,
                services,
                booking.isCustomService(),
                booking.getCustomServiceName(),
                booking.getCustomServicePrice(),
                booking.getCustomTotalPrice(),
                booking.getDurationMinutes(),
                booking.getCurrentSession(),
                booking.getTotalSessions(),
                booking.getLinkingStatus() != null ? booking.getLinkingStatus().name() : null,
                linkedPackage,
                booking.isPaidInStore(),
                sales
        );
    }

    private static <T> T requireNotNull(T value, String message) {
        if (value == null) throw new BadRequestException(message);
        return value;
    }
}