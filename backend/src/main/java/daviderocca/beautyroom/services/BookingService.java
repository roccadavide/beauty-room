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
import daviderocca.beautyroom.DTO.bookingDTOs.ServiceEntryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PackageSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.ServiceSummaryDTO;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.enums.BookingStatus;
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
import java.util.List;
import java.util.Map;
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
    private final UserLookupService userLookupService;
    private final ClientPackageService clientPackageService;
    private final BookingPackageLinkRepository bookingPackageLinkRepository;

    @PersistenceContext
    private EntityManager entityManager;

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
        boolean useEntries    = dto.serviceEntries() != null && !dto.serviceEntries().isEmpty();
        boolean hasCatalog    = useEntries || (dto.serviceIds() != null && !dto.serviceIds().isEmpty());
        boolean hasCustom     = Boolean.TRUE.equals(dto.hasCustomService());
        boolean hasPkg        = dto.packageAssignmentId() != null;
        boolean hasPkgCredit  = dto.packageCreditId() != null;

        if (!hasCatalog && !hasCustom && !hasPkg && !hasPkgCredit) {
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

        ClientPackageAssignment assignment = null;
        if (hasPkg) {
            assignment = clientPackageService.validateActivePackage(dto.packageAssignmentId());
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
                UUID optId = (useEntries && i < entries.size()) ? entries.get(i).optionId() : null;
                int dur = svc.getDurationMin();
                if (optId != null) {
                    ServiceOption opt = serviceOptionRepository.findById(optId).orElse(null);
                    if (opt != null && opt.getDurationMin() != null && opt.getDurationMin() > 0) {
                        dur = opt.getDurationMin();
                    }
                }
                totalDuration += dur;
            }
            if (hasCustom) totalDuration += dto.customServiceDurationMinutes();
            if (hasPkg && assignment != null && assignment.getServiceOption() != null) {
                ServiceOption pkgOption = assignment.getServiceOption();
                Integer optDuration = pkgOption.getDurationMin();
                if (optDuration != null && optDuration > 0) {
                    totalDuration += optDuration;
                } else if (pkgOption.getService() != null && pkgOption.getService().getDurationMin() > 0) {
                    totalDuration += pkgOption.getService().getDurationMin();
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
        }
        totalDuration = Math.max(totalDuration, 15);

        // ── Step 4: overlap check ─────────────────────────────────────────────
        LocalDateTime start = dto.date().atTime(dto.startTime()).truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime end   = start.plusMinutes(totalDuration);

        if (hasOverlapIncludingPadding(start, end)) {
            throw new BadRequestException("Lo slot selezionato non è disponibile.");
        }

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
        }

        booking.setDurationMinutes(totalDuration);
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

        // Customer registry (best-effort)
        try {
            Customer customer = customerService.findOrCreate(
                    booking.getCustomerName(), booking.getCustomerPhone(),
                    booking.getCustomerEmail(), dto.notes());
            booking.setCustomer(customer);
        } catch (Exception e) {
            log.warn("Customer upsert failed for multi-service booking: {}", e.getMessage());
        }

        Booking saved = bookingRepository.save(booking);
        log.info("Multi-service booking created: id={} duration={}min services={} custom={} pkg={}",
                saved.getBookingId(), totalDuration, catalogServices.size(), hasCustom, hasPkg);

        // ── Step 5b: persist per-service option_id in booking_services ───────
        if (useEntries) {
            entityManager.flush(); // ensure booking row is committed before FK insert
            List<ServiceEntryDTO> entries = dto.serviceEntries();
            for (int i = 0; i < entries.size(); i++) {
                ServiceEntryDTO e = entries.get(i);
                entityManager.createNativeQuery("""
                        INSERT INTO booking_services (id, booking_id, service_id, option_id, sort_order)
                        VALUES (gen_random_uuid(), :bookingId, :serviceId, :optionId, :sortOrder)
                        """)
                        .setParameter("bookingId", saved.getBookingId())
                        .setParameter("serviceId", e.serviceId())
                        .setParameter("optionId", e.optionId())
                        .setParameter("sortOrder", i + 1)
                        .executeUpdate();
            }
        }

        // ── Step 6: link / create / update package session ────────────────────
        // NOTE: linkBooking() uses REQUIRES_NEW and cannot see the uncommitted booking.
        // Use managed entities directly to stay within this SERIALIZABLE transaction.
        boolean hasSessionNumbers = dto.currentSession() != null && dto.totalSessions() != null;

        if (hasPkg) {
            // CASE C — packageAssignmentId provided: link the booking and recalculate from scratch.
            if (assignment.getSessionsRemaining() <= 0) {
                throw new BadRequestException("Il pacchetto non ha sessioni rimanenti.");
            }

            BookingPackageLink pkgLink = new BookingPackageLink();
            pkgLink.setBooking(saved);
            pkgLink.setAssignment(assignment);
            pkgLink.setSessionNumber(0); // placeholder; set correctly by recalculate below
            pkgLink.setSessionTrackedAtCreation(true);
            bookingPackageLinkRepository.save(pkgLink);

            clientPackageService.recalculatePackageSessions(assignment.getId());
            log.info("CASE C: linked bookingId={} to assignmentId={} → recalculated",
                    saved.getBookingId(), assignment.getId());

        } else if (hasPkgCredit) {
            // CASE D — packageCreditId provided: PackageCredit FK already set before save.
            // Session will be decremented by packageCreditService.consumeSessionForBooking()
            // when the booking is marked COMPLETED (wired in updateBookingStatus).
            log.info("CASE D: bookingId={} linked to packageCreditId={}",
                    saved.getBookingId(), packageCredit.getPackageCreditId());

        } else if (hasSessionNumbers) {
            // CASE A / CASE B — admin filled in totalSessions; link and recalculate.
            // CASE B only reuses an existing package when it is for the same catalog service
            // (matched by serviceOption.service.serviceId). A custom-service booking or a booking
            // whose primary service does not match any active package always takes CASE A.
            final UUID primaryServiceId = (primaryService != null) ? primaryService.getServiceId() : null;
            ClientPackageAssignment pkg = clientPackageService
                    .findActiveAssignmentsByClientName(saved.getCustomerName())
                    .stream()
                    .filter(a -> primaryServiceId != null
                            && a.getServiceOption() != null
                            && a.getServiceOption().getService() != null
                            && a.getServiceOption().getService().getServiceId().equals(primaryServiceId))
                    .findFirst()
                    .orElse(null);

            if (pkg == null) {
                // CASE A: no matching active package found — create one
                pkg = new ClientPackageAssignment();
                pkg.setClientName(saved.getCustomerName());
                pkg.setTotalSessions(dto.totalSessions());
                pkg.setSessionsRemaining(dto.totalSessions()); // recalculate will override
                pkg.setStatus(ClientPackageStatus.ACTIVE);
                // Derive a display name from the booking's primary service so the
                // package card shows a meaningful title instead of nothing.
                if (!catalogServices.isEmpty()) {
                    pkg.setCustomPackageName(catalogServices.get(0).getTitle());
                } else if (saved.isCustomService() && saved.getCustomServiceName() != null) {
                    pkg.setCustomPackageName(saved.getCustomServiceName().trim());
                }
                log.info("CASE A: creating new assignment for client '{}'", saved.getCustomerName());
            } else {
                // CASE B: update total sessions; recalculate will set remaining
                pkg.setTotalSessions(dto.totalSessions());
                log.info("CASE B: updating existing assignmentId={} for client '{}'",
                        pkg.getId(), saved.getCustomerName());
            }
            pkg = clientPackageService.saveAssignment(pkg);

            BookingPackageLink pkgLink = new BookingPackageLink();
            pkgLink.setBooking(saved);
            pkgLink.setAssignment(pkg);
            pkgLink.setSessionNumber(0); // placeholder; set correctly by recalculate below
            pkgLink.setSessionTrackedAtCreation(true);
            bookingPackageLinkRepository.save(pkgLink);

            clientPackageService.recalculatePackageSessions(pkg.getId());
            log.info("CASE A/B: linked bookingId={} to assignmentId={} totalSessions={} → recalculated",
                    saved.getBookingId(), pkg.getId(), dto.totalSessions());
        }

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
        return convertToDTO(hydrated);
    }

    /**
     * Creates a CONFIRMED booking for a multi-service Stripe checkout after payment succeeds.
     * Called from the webhook — runs at SERIALIZABLE isolation to detect slot conflicts atomically.
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
            String stripeSessionId
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

        Booking booking = new Booking(name, email, phone, start, end, notes, primary, null, null);
        if (!services.isEmpty()) booking.setServices(new ArrayList<>(services));
        booking.setDurationMinutes(totalDurationMinutes);
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

        // Notifica admin
        try {
            String svc  = primary != null ? primary.getTitle() : (services.isEmpty() ? "Trattamento" : services.get(0).getTitle());
            String when = saved.getStartTime().format(NOTIF_FMT);
            notificationService.create(
                NotificationType.NEW_BOOKING,
                "Nuova prenotazione online 🗓",
                name + " · " + svc + " · " + when,
                saved.getBookingId(),
                "BOOKING"
            );
        } catch (Exception e) {
            log.warn("Notification failed for multi-service webhook booking {}: {}", saved.getBookingId(), e.getMessage());
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

        // Capture assignmentId before delete — the link row will cascade-delete with the booking
        UUID pkgAssignmentId = null;
        try {
            pkgAssignmentId = bookingPackageLinkRepository.findByBookingBookingIdWithAssignment(bookingId)
                    .map(l -> l.getAssignment().getId())
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Could not load package link before delete for booking {}: {}", bookingId, e.getMessage());
        }

        // Delete the link first via bulk JPQL — bypasses L1 cache entirely, goes straight to DB.
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
        log.info("Booking hard-deleted by admin: id={}", bookingId);

        // Link is now gone (cascade); recalculate so remaining count drops correctly
        if (pkgAssignmentId != null) {
            final UUID assignmentId = pkgAssignmentId;
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
            Refund.create(Map.of("payment_intent", paymentIntentId));
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

        emailOutboxService.enqueueBookingRefunded(booking);
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
        emailOutboxService.enqueueBookingConfirmed(updated);
        log.info("Booking updated: id={} status={} padding={}min", updated.getBookingId(), updated.getBookingStatus(), updated.getPaddingMinutes());
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

        // Total duration: explicit override → computed from services → keep existing
        int totalDuration;
        if (dto.customTotalDurationMin() != null && dto.customTotalDurationMin() > 0) {
            totalDuration = dto.customTotalDurationMin();
        } else if (hasCatalog || hasCustom) {
            totalDuration = 0;
            List<ServiceEntryDTO> updEntries = useEntries ? dto.serviceEntries() : List.of();
            for (int i = 0; i < catalogServices.size(); i++) {
                ServiceItem svc = catalogServices.get(i);
                UUID optId = (useEntries && i < updEntries.size()) ? updEntries.get(i).optionId() : null;
                int dur = svc.getDurationMin();
                if (optId != null) {
                    ServiceOption opt = serviceOptionRepository.findById(optId).orElse(null);
                    if (opt != null && opt.getDurationMin() != null && opt.getDurationMin() > 0) {
                        dur = opt.getDurationMin();
                    }
                }
                totalDuration += dur;
            }
            if (hasCustom) totalDuration += dto.customServiceDurationMinutes();
        } else {
            // Package-only or no services in payload — keep the booking's existing duration
            totalDuration = found.getDurationMinutes() != null
                    ? found.getDurationMinutes()
                    : (int) java.time.Duration.between(found.getStartTime(), found.getEndTime()).toMinutes();
        }
        totalDuration = Math.max(totalDuration, 5);

        LocalDateTime start = dto.date().atTime(dto.startTime()).truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime end   = start.plusMinutes(totalDuration);

        if (hasOverlapIncludingPaddingExcluding(found.getBookingId(), start, end)) {
            throw new BadRequestException("Lo slot selezionato non è disponibile.");
        }

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
        }

        // Update custom service fields
        found.setCustomService(hasCustom);
        if (hasCustom) {
            found.setCustomServiceName(dto.customServiceName().trim());
            found.setCustomServicePrice(dto.customServicePrice());
        } else if (hasCatalog) {
            // Switching from custom to catalog — clear stale custom fields
            found.setCustomServiceName(null);
            found.setCustomServicePrice(null);
        }

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
        if (useEntries && hasCatalog) {
            entityManager.flush();
            List<ServiceEntryDTO> entries = dto.serviceEntries();
            for (int i = 0; i < entries.size(); i++) {
                ServiceEntryDTO e = entries.get(i);
                entityManager.createNativeQuery("""
                        INSERT INTO booking_services (id, booking_id, service_id, option_id, sort_order)
                        VALUES (gen_random_uuid(), :bookingId, :serviceId, :optionId, :sortOrder)
                        """)
                        .setParameter("bookingId", updated.getBookingId())
                        .setParameter("serviceId", e.serviceId())
                        .setParameter("optionId", e.optionId())
                        .setParameter("sortOrder", i + 1)
                        .executeUpdate();
            }
        }

        maybeRecalculatePackage(bookingId);
        emailOutboxService.enqueueBookingConfirmed(updated);
        log.info("Multi-service booking updated: id={} start={} duration={}min custom={}",
                updated.getBookingId(), start, totalDuration, hasCustom);
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
        maybeRecalculatePackage(bookingId);

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
        maybeRecalculatePackage(bookingId);
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

    private AdminBookingCardDTO toAdminCard(Booking b) {
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

        // Fetch services with per-entry option_id from booking_services join table
        @SuppressWarnings("unchecked")
        List<Object[]> svcRows = entityManager.createNativeQuery("""
                SELECT bs.service_id, s.title,
                       COALESCE(so.duration_min, s.duration_min) AS duration_min,
                       COALESCE(so.price, s.price) AS price,
                       bs.option_id, so.name AS option_name
                FROM booking_services bs
                JOIN services s ON s.service_id = bs.service_id
                LEFT JOIN service_options so ON so.option_id = bs.option_id
                WHERE bs.booking_id = :bookingId
                ORDER BY bs.sort_order
                """)
                .setParameter("bookingId", b.getBookingId())
                .getResultList();
        List<ServiceSummaryDTO> services = svcRows.stream()
                .map(r -> {
                    UUID sId = r[0] instanceof UUID u ? u : UUID.fromString(r[0].toString());
                    UUID oId = r[4] == null ? null : (r[4] instanceof UUID u ? u : UUID.fromString(r[4].toString()));
                    return new ServiceSummaryDTO(
                            sId,
                            (String) r[1],
                            r[2] != null ? ((Number) r[2]).intValue() : 0,
                            r[3] instanceof BigDecimal bd ? bd : (r[3] != null ? new BigDecimal(r[3].toString()) : null),
                            oId,
                            (String) r[5]
                    );
                })
                .toList();

        boolean consentRequired = (b.getService() != null && b.getService().isConsentRequired())
                || services.stream().anyMatch(s -> false); // service-level consent flag not on summary

        // Load the package link once; use it for both the linkedPkg summary AND the live
        // session number (booking.currentSession may be null for CASE C bookings where the
        // frontend sends null, and stale for bookings created before this fix was deployed).
        Integer linkSessionNumber   = null;
        Integer linkTotalSessions   = null;
        PackageSummaryDTO linkedPkg = null;
        try {
            var linkOpt = bookingPackageLinkRepository
                    .findByBookingBookingIdWithAssignment(b.getBookingId());
            if (linkOpt.isPresent()) {
                BookingPackageLink link = linkOpt.get();
                ClientPackageAssignment a = link.getAssignment();
                if (link.getSessionNumber() > 0) linkSessionNumber = link.getSessionNumber();
                linkTotalSessions = a.getTotalSessions();
                String pkgName = a.getCustomPackageName() != null
                        ? a.getCustomPackageName()
                        : (a.getServiceOption() != null
                                ? (a.getServiceOption().getService() != null
                                        ? a.getServiceOption().getService().getTitle()
                                        : a.getServiceOption().getName())
                                : "Trattamento");
                linkedPkg = new PackageSummaryDTO(pkgName, a.getSessionsRemaining());
            }
        } catch (Exception e) {
            log.warn("Could not resolve linkedPackage for booking {}: {}", b.getBookingId(), e.getMessage());
        }

        // Custom service duration: compute as total duration minus catalog services' sum.
        // This is exact for custom-only bookings and a best-effort approximation for mixed ones.
        Integer customServiceDurationMinutes = null;
        if (b.isCustomService()) {
            int catalogTotal = b.getServices().stream().mapToInt(ServiceItem::getDurationMin).sum();
            int raw = (b.getDurationMinutes() != null ? b.getDurationMinutes() : 0) - catalogTotal;
            customServiceDurationMinutes = raw > 0 ? raw : (b.getDurationMinutes() != null ? b.getDurationMinutes() : 60);
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
                linkSessionNumber != null ? linkSessionNumber : b.getCurrentSession(),
                linkTotalSessions != null ? linkTotalSessions : b.getTotalSessions(),
                b.getLinkedUser() != null ? b.getLinkedUser().getUserId() : null,
                b.getLinkingStatus() != null ? b.getLinkingStatus().name() : null,
                linkedPkg,
                b.isPaidInStore(),
                b.getPaidAt(),
                paidOnline,
                refundable
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

    /**
     * If the booking has a package link, triggers a full recalculation of that
     * assignment's session counts. Best-effort — never propagates exceptions.
     */
    private void maybeRecalculatePackage(UUID bookingId) {
        try {
            bookingPackageLinkRepository.findByBookingBookingIdWithAssignment(bookingId)
                    .ifPresent(link -> clientPackageService.recalculatePackageSessions(link.getAssignment().getId()));
        } catch (Exception e) {
            log.warn("maybeRecalculatePackage failed for bookingId={}: {}", bookingId, e.getMessage());
        }
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
        List<ServiceSummaryDTO> services = booking.getServices().stream()
                .map(s -> new ServiceSummaryDTO(s.getServiceId(), s.getTitle(), s.getDurationMin(), s.getPrice(), null, null))
                .toList();

        // Fallback service title for backward compat
        String serviceTitle = booking.getService() != null
                ? booking.getService().getTitle()
                : (booking.isCustomService() ? booking.getCustomServiceName() : null);

        PackageSummaryDTO linkedPackage = null;
        try {
            linkedPackage = bookingPackageLinkRepository
                    .findByBookingBookingIdWithAssignment(booking.getBookingId())
                    .map(link -> {
                        ClientPackageAssignment a = link.getAssignment();
                        String pkgName = a.getCustomPackageName() != null
                                ? a.getCustomPackageName()
                                : (a.getServiceOption() != null
                                        ? (a.getServiceOption().getService() != null
                                                ? a.getServiceOption().getService().getTitle()
                                                : a.getServiceOption().getName())
                                        : "Trattamento");
                        return new PackageSummaryDTO(pkgName, a.getSessionsRemaining());
                    })
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Could not resolve package summary for booking {}: {}", booking.getBookingId(), e.getMessage());
        }

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
                serviceTitle,
                services,
                booking.isCustomService(),
                booking.getCustomServiceName(),
                booking.getCustomServicePrice(),
                booking.getDurationMinutes(),
                booking.getCurrentSession(),
                booking.getTotalSessions(),
                booking.getLinkingStatus() != null ? booking.getLinkingStatus().name() : null,
                linkedPackage,
                booking.isPaidInStore()
        );
    }

    private static <T> T requireNotNull(T value, String message) {
        if (value == null) throw new BadRequestException(message);
        return value;
    }
}