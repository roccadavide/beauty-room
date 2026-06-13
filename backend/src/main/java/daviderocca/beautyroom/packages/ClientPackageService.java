package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.DTO.bookingDTOs.PackageItemSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PackageSummaryDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.ClientPackagePaymentMode;
import daviderocca.beautyroom.enums.ClientPackageStatus;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.DuplicateResourceException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.linking.LinkingOutcome;
import daviderocca.beautyroom.linking.UserLookupService;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ServiceItemRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClientPackageService {

    private final ClientPackageAssignmentRepository assignmentRepo;
    private final BookingPackageLinkRepository linkRepo;
    private final ServiceOptionRepository serviceOptionRepo;
    private final ServiceItemRepository serviceItemRepo;
    private final BookingRepository bookingRepository;
    private final UserLookupService userLookupService;

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public ClientPackageAssignmentDTO create(ClientPackageAssignmentRequestDTO req) {
        String clientName = req.clientName().trim();

        // Resolve composition items. Invariant: every package has >= 1 item.
        List<ClientPackageAssignmentItem> items = resolveItemsFromRequest(req);

        // Parent service / serviceOption are derived from item position=0
        // so legacy code paths (computeSessionPrice, recalculate, toDTO fallbacks)
        // keep working without reading items[] directly.
        ClientPackageAssignmentItem head = items.get(0);
        ServiceOption headOption = head.getServiceOption();
        ServiceItem headService = head.getService();
        if (headService == null && headOption != null && headOption.getService() != null) {
            headService = headOption.getService();
        }

        // Guard: reject exact duplicates (same client name + same effective service option while ACTIVE)
        if (headOption != null) {
            UUID headOptionId = headOption.getOptionId();
            boolean alreadyActive = assignmentRepo.findByClientNameIgnoreCase(clientName)
                    .stream()
                    .anyMatch(a -> a.getStatus() == ClientPackageStatus.ACTIVE
                            && a.getServiceOption() != null
                            && a.getServiceOption().getOptionId().equals(headOptionId));
            if (alreadyActive) {
                throw new DuplicateResourceException(
                        "Questa cliente ha già un pacchetto attivo per questo trattamento con questa opzione.");
            }
        }

        ClientPackageAssignment assignment = new ClientPackageAssignment();
        assignment.setClientName(clientName);
        assignment.setService(headService);
        assignment.setServiceOption(headOption);
        assignment.setTotalSessions(req.totalSessions());
        // Honor explicit sessionsRemaining (admin correction / mid-course packages with
        // startSession > 1). Same clamp as update(): 0..totalSessions. Default to
        // totalSessions when caller omits it.
        if (req.sessionsRemaining() != null) {
            int clamped = Math.max(0, Math.min(req.sessionsRemaining(), req.totalSessions()));
            assignment.setSessionsRemaining(clamped);
        } else {
            assignment.setSessionsRemaining(req.totalSessions());
        }
        assignment.setPricePaid(req.pricePaid());
        assignment.setNotes(req.notes() != null ? req.notes().trim() : null);
        assignment.setCustomPackageName(req.customPackageName() != null ? req.customPackageName().trim() : null);
        assignment.setStatus(ClientPackageStatus.ACTIVE);
        assignment.setSessionDurationMin(normalizePositive(req.sessionDurationMin()));
        // Payment mode: an explicit mode wins; otherwise the legacy paidUpfront flag drives it
        // (byte-for-byte unchanged when paymentMode is absent). paidUpfront stays in sync so
        // existing readers (buildPackageSummary, etc.) keep working.
        ClientPackagePaymentMode mode = req.paymentMode();
        boolean upfront;
        if (mode == null) {
            upfront = Boolean.TRUE.equals(req.paidUpfront());
            mode = upfront ? ClientPackagePaymentMode.UPFRONT : ClientPackagePaymentMode.PER_SESSION;
        } else {
            upfront = (mode == ClientPackagePaymentMode.UPFRONT);
        }
        assignment.setPaymentMode(mode);
        assignment.setPaidUpfront(upfront);
        assignment.setStartSession(req.startSession() != null && req.startSession() >= 1 ? req.startSession() : 1);

        // Explicit linked user override (admin can pre-link)
        if (req.linkedUserId() != null) {
            User user = userLookupService.findById(req.linkedUserId());
            assignment.setLinkedUser(user);
        } else {
            // Auto-link by name (best-effort)
            try {
                LinkingOutcome outcome = userLookupService.tryLink(clientName);
                if (outcome.user() != null) {
                    assignment.setLinkedUser(outcome.user());
                }
            } catch (Exception e) {
                log.warn("Auto-link failed for assignment clientName='{}': {}", clientName, e.getMessage());
            }
        }

        for (ClientPackageAssignmentItem it : items) {
            assignment.addItem(it);
        }

        return toDTO(assignmentRepo.save(assignment));
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ClientPackageAssignmentDTO findById(UUID id) {
        return toDTO(requireAssignment(id));
    }

    @Transactional(readOnly = true)
    public List<ClientPackageAssignmentDTO> findAll() {
        return assignmentRepo.findAll().stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public List<ClientPackageAssignmentDTO> findByUserId(UUID userId) {
        return assignmentRepo.findByLinkedUserUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public List<ClientPackageAssignmentDTO> findActiveByClientName(String name) {
        return assignmentRepo.findByClientNameIgnoreCase(name)
                .stream()
                .filter(a -> a.getStatus() == ClientPackageStatus.ACTIVE)
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ClientPackageAssignmentDTO> findActiveByUserId(UUID userId) {
        return assignmentRepo.findByLinkedUserUserIdAndStatusOrderByCreatedAtDesc(userId, ClientPackageStatus.ACTIVE)
                .stream().map(this::toDTO).toList();
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public ClientPackageAssignmentDTO update(UUID id, ClientPackageAssignmentRequestDTO req) {
        ClientPackageAssignment assignment = requireAssignment(id);
        int completedSessions = assignment.getTotalSessions() - assignment.getSessionsRemaining();
        if (req.totalSessions() < completedSessions) {
            throw new BadRequestException(
                    "Le sedute totali non possono essere inferiori alle sedute già effettuate (" + completedSessions + ").");
        }
        assignment.setClientName(req.clientName().trim());
        assignment.setTotalSessions(req.totalSessions());
        assignment.setPricePaid(req.pricePaid());
        assignment.setNotes(req.notes() != null ? req.notes().trim() : null);
        assignment.setCustomPackageName(req.customPackageName() != null ? req.customPackageName().trim() : null);

        if (req.sessionsRemaining() != null) {
            int clamped = Math.max(0, Math.min(req.sessionsRemaining(), req.totalSessions()));
            assignment.setSessionsRemaining(clamped);
        }

        // Phase-1 extension fields. Null means "leave existing value untouched".
        if (req.sessionDurationMin() != null) {
            assignment.setSessionDurationMin(normalizePositive(req.sessionDurationMin()));
        }
        // Payment mode (backward-compatible): an explicit mode wins; otherwise the legacy
        // paidUpfront flag drives it, kept in sync with the mode. A bare !upfront legacy edit
        // never clobbers a deliberate INSTALLMENTS plan (left untouched in that case).
        if (req.paymentMode() != null) {
            var mode = req.paymentMode();
            assignment.setPaymentMode(mode);
            assignment.setPaidUpfront(mode == ClientPackagePaymentMode.UPFRONT);
        } else if (req.paidUpfront() != null) {
            boolean upfront = req.paidUpfront();
            assignment.setPaidUpfront(upfront);
            if (upfront) {
                assignment.setPaymentMode(ClientPackagePaymentMode.UPFRONT);
            } else if (assignment.getPaymentMode() == ClientPackagePaymentMode.UPFRONT) {
                assignment.setPaymentMode(ClientPackagePaymentMode.PER_SESSION);
            }
        }
        if (req.startSession() != null && req.startSession() >= 1) {
            assignment.setStartSession(req.startSession());
        }

        // Composition update. items[] is the source of truth when provided —
        // we replace the collection AND re-derive the parent service/serviceOption
        // from the new item position=0 to keep the "representative" mirror in sync.
        // When items[] is absent we fall back to legacy single-option behaviour,
        // then rebuild items[0] from the final parent state so the invariant
        // "items[0] mirrors the parent representative" holds for both paths.
        if (req.items() != null && !req.items().isEmpty()) {
            List<ClientPackageAssignmentItem> newItems = buildItemsFromRequestList(req.items());
            assignment.replaceItems(newItems);
            ClientPackageAssignmentItem head = newItems.get(0);
            ServiceOption headOption = head.getServiceOption();
            ServiceItem headService = head.getService();
            if (headService == null && headOption != null && headOption.getService() != null) {
                headService = headOption.getService();
            }
            assignment.setServiceOption(headOption);
            assignment.setService(headService);
        } else {
            if (req.serviceOptionId() != null) {
                ServiceOption option = serviceOptionRepo.findById(req.serviceOptionId())
                        .orElseThrow(() -> new ResourceNotFoundException("ServiceOption not found: " + req.serviceOptionId()));
                assignment.setServiceOption(option);
                if (option.getService() != null) {
                    assignment.setService(option.getService());
                }
            } else {
                assignment.setServiceOption(null);
                // Note: we do NOT clear assignment.service here. The admin may want the
                // package to stay tied to the underlying service even when the option is cleared.
            }
            // Rebuild items[0] from the (possibly updated) parent representative so
            // legacy-shaped updates can no longer desync the composition mirror.
            // Multi-line composition is by definition not expressible via legacy
            // fields, so collapsing to a single mirror item is the correct semantics
            // for legacy requests.
            assignment.replaceItems(List.of(buildMirrorItemFromParent(assignment)));
        }

        if (req.linkedUserId() != null) {
            User user = userLookupService.findById(req.linkedUserId());
            assignment.setLinkedUser(user);
        }

        ClientPackageAssignment saved = assignmentRepo.save(assignment);

        // If the caller did not specify sessionsRemaining explicitly, realign it with
        // the actual booking links. This keeps the package consistent when only
        // totalSessions or pricePaid changes — without it, sessionsRemaining stays
        // stale relative to the new totalSessions.
        if (req.sessionsRemaining() == null) {
            recalculatePackageSessions(saved.getId());
            saved = requireAssignment(saved.getId());
        }

        return toDTO(saved);
    }

    @Transactional
    public ClientPackageAssignmentDTO cancel(UUID id) {
        ClientPackageAssignment assignment = requireAssignment(id);
        if (assignment.getStatus() == ClientPackageStatus.CANCELLED) {
            throw new BadRequestException("Package already cancelled.");
        }
        assignment.setStatus(ClientPackageStatus.CANCELLED);
        return toDTO(assignmentRepo.save(assignment));
    }

    // ── Link booking to package session ───────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public BookingPackageLinkDTO linkBooking(LinkBookingRequestDTO req) {
        // Guard: booking must not already be linked
        if (linkRepo.findByBookingBookingId(req.bookingId()).isPresent()) {
            throw new BadRequestException("Booking is already linked to a package session.");
        }

        Booking booking = bookingRepository.findById(req.bookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + req.bookingId()));

        ClientPackageAssignment assignment = requireAssignment(req.assignmentId());

        if (assignment.getStatus() != ClientPackageStatus.ACTIVE) {
            throw new BadRequestException("Package is not ACTIVE (status=" + assignment.getStatus() + ").");
        }

        BookingPackageLink link = new BookingPackageLink();
        link.setBooking(booking);
        link.setAssignment(assignment);

        BookingPackageLink saved = linkRepo.save(link);
        log.info("Linked bookingId={} to assignmentId={}", req.bookingId(), req.assignmentId());
        return toLinkDTO(saved);
    }

    // ── Decrement session on booking completion ───────────────────────────────

    /**
     * Called when a booking transitions to COMPLETED.
     * If the booking has a package link, decrements sessionsRemaining.
     * Marks package EXHAUSTED when sessionsRemaining reaches 0.
     * Best-effort — should always be wrapped in try-catch by the caller.
     */
    @Transactional
    public void decrementSessionOnCompletion(Booking booking) {
        linkRepo.findByBookingBookingId(booking.getBookingId()).ifPresent(link -> {
            if (link.isSessionTrackedAtCreation()) {
                log.info("decrementSession: booking {} already tracked at creation — skipping completion decrement",
                        booking.getBookingId());
                return;
            }
            ClientPackageAssignment assignment = link.getAssignment();
            if (assignment.getStatus() != ClientPackageStatus.ACTIVE) {
                log.warn("decrementSession: assignment {} is not ACTIVE — skipping", assignment.getId());
                return;
            }
            int remaining = assignment.getSessionsRemaining() - 1;
            assignment.setSessionsRemaining(Math.max(remaining, 0));
            if (remaining <= 0) {
                assignment.setStatus(ClientPackageStatus.EXHAUSTED);
                log.info("Package {} EXHAUSTED for client '{}'", assignment.getId(), assignment.getClientName());
            }
            assignmentRepo.save(assignment);
            log.info("Session decremented: assignmentId={} remaining={}", assignment.getId(), assignment.getSessionsRemaining());
        });
    }

    // ── Recalculate from scratch ──────────────────────────────────────────────

    /**
     * Recomputes sessionsRemaining and sessionNumber for every link of an assignment
     * from scratch, based on the actual booking statuses in the DB.
     * CANCELLED and NO_SHOW bookings do not count as used sessions.
     * Idempotent: calling it twice yields the same result.
     */
    @Transactional
    public void recalculatePackageSessions(UUID packageAssignmentId) {
        ClientPackageAssignment assignment = assignmentRepo.findById(packageAssignmentId).orElse(null);
        if (assignment == null) {
            log.warn("recalculate: assignment {} not found — skipping", packageAssignmentId);
            return;
        }
        if (assignment.getStatus() == ClientPackageStatus.CANCELLED) {
            log.info("recalculate: assignment {} is CANCELLED — skipping", packageAssignmentId);
            return;
        }

        List<BookingPackageLink> allLinks = linkRepo.findByAssignmentIdWithBooking(packageAssignmentId);

        List<BookingPackageLink> activeLinks = allLinks.stream()
                .filter(l -> {
                    BookingStatus s = l.getBooking().getBookingStatus();
                    return s != BookingStatus.CANCELLED && s != BookingStatus.NO_SHOW;
                })
                .sorted(Comparator.comparing(l -> l.getBooking().getStartTime()))
                .collect(Collectors.toList());

        if (activeLinks.isEmpty()) {
            // No active sessions — release the full package
            assignment.setSessionsRemaining(assignment.getTotalSessions());
            assignment.setStatus(ClientPackageStatus.ACTIVE);
            assignmentRepo.save(assignment);
            log.info("recalculate: assignmentId={} no active links — remaining={}",
                    packageAssignmentId, assignment.getTotalSessions());
            return;
        }

        // Anchor-based renumbering:
        //   The first chronological link "anchors" its sessionNumber.
        //   All subsequent links follow as anchor+1, anchor+2, ...
        // This preserves an explicitly-set initial number (e.g. "seduta 3 di 10")
        // while still auto-scaling the rest when a session in the middle is cancelled.
        int anchor = activeLinks.get(0).getSessionNumber();
        if (anchor < 1) anchor = 1;  // safety fallback if the anchor was never set

        for (int i = 0; i < activeLinks.size(); i++) {
            BookingPackageLink link = activeLinks.get(i);
            Booking bk = link.getBooking();
            int newSessionNum = anchor + i;
            link.setSessionNumber(newSessionNum);
            bk.setCurrentSession(newSessionNum);
            bk.setTotalSessions(assignment.getTotalSessions());
        }
        linkRepo.saveAll(activeLinks);
        bookingRepository.saveAll(
                activeLinks.stream().map(BookingPackageLink::getBooking).toList());

        int maxSessionUsed = anchor + activeLinks.size() - 1;
        int sessionsRemaining = Math.max(assignment.getTotalSessions() - maxSessionUsed, 0);
        assignment.setSessionsRemaining(sessionsRemaining);
        assignment.setStatus(sessionsRemaining <= 0 ? ClientPackageStatus.EXHAUSTED : ClientPackageStatus.ACTIVE);
        assignmentRepo.save(assignment);

        log.info("recalculate: assignmentId={} anchor={} count={} maxSession={} sessionsRemaining={}",
                packageAssignmentId, anchor, activeLinks.size(), maxSessionUsed, sessionsRemaining);
    }

    /**
     * Recalculates all non-cancelled assignments. Safe to call multiple times.
     * Used for the one-time data-fix admin endpoint.
     */
    @Transactional
    public int recalculateAllPackageSessions() {
        List<ClientPackageAssignment> all = assignmentRepo.findAll();
        int count = 0;
        for (ClientPackageAssignment a : all) {
            if (a.getStatus() != ClientPackageStatus.CANCELLED) {
                recalculatePackageSessions(a.getId());
                count++;
            }
        }
        log.info("recalculateAll: processed {} assignments", count);
        return count;
    }

    // ── Validation helper for booking creation ────────────────────────────────

    /**
     * Returns the assignment if it is ACTIVE and has sessions remaining.
     * Throws BadRequestException if not.
     */
    @Transactional(readOnly = true)
    public ClientPackageAssignment validateActivePackage(UUID assignmentId) {
        ClientPackageAssignment a = requireAssignment(assignmentId);
        if (a.getStatus() != ClientPackageStatus.ACTIVE) {
            throw new BadRequestException("Il pacchetto non è attivo (stato: " + a.getStatus() + ").");
        }
        if (a.getSessionsRemaining() <= 0) {
            throw new BadRequestException("Il pacchetto non ha sessioni disponibili.");
        }
        return a;
    }

    /**
     * Returns the per-session price for a package assignment.
     * Priority:
     *   1. pricePaid / totalSessions  (the actual price Michela charged)
     *   2. serviceOption.price        (catalog option price, if any)
     *   3. service.price              (catalog service price)
     *   4. null                       (truly custom package, no catalog reference)
     */
    public BigDecimal computeSessionPrice(ClientPackageAssignment a) {
        if (a == null) return null;
        if (a.getPricePaid() != null
                && a.getPricePaid().compareTo(BigDecimal.ZERO) > 0
                && a.getTotalSessions() > 0) {
            return a.getPricePaid()
                    .divide(BigDecimal.valueOf(a.getTotalSessions()), 2, RoundingMode.HALF_UP);
        }
        if (a.getServiceOption() != null && a.getServiceOption().getPrice() != null) {
            return a.getServiceOption().getPrice();
        }
        ServiceItem svc = a.getService() != null
                ? a.getService()
                : (a.getServiceOption() != null ? a.getServiceOption().getService() : null);
        if (svc != null && svc.getPrice() != null) {
            return svc.getPrice();
        }
        return null;
    }

    /**
     * Returns a summary of the package linked to a booking, if any.
     */
    @Transactional(readOnly = true)
    public Optional<PackageSummaryDTO> getPackageSummaryForBooking(UUID bookingId) {
        return linkRepo.findByBookingBookingId(bookingId).map(link -> {
            ClientPackageAssignment a = link.getAssignment();
            String name;
            ServiceItem svc = a.getService() != null
                    ? a.getService()
                    : (a.getServiceOption() != null ? a.getServiceOption().getService() : null);
            if (a.getServiceOption() != null && svc != null) {
                name = svc.getTitle() + " · " + a.getServiceOption().getName();
            } else if (a.getServiceOption() != null) {
                name = a.getServiceOption().getName();
            } else if (svc != null) {
                name = svc.getTitle();
            } else if (a.getCustomPackageName() != null && !a.getCustomPackageName().isBlank()) {
                name = a.getCustomPackageName();
            } else {
                name = a.getClientName();
            }
            // V62: settled = upfront-paid OR per-link paid. Locked = upfront only.
            // Mirror BookingService.buildPackageSummary so this alternate entry point
            // surfaces identical state (drawer + agenda + any future consumer).
            boolean paidLocked = a.isPaidUpfront();
            boolean paid = paidLocked || link.isPaid();
            BigDecimal sessionPrice = paidLocked ? BigDecimal.ZERO : computeSessionPrice(a);
            return new PackageSummaryDTO(
                    a.getId(),
                    name,
                    link.getSessionNumber(),
                    a.getTotalSessions(),
                    a.getSessionsRemaining(),
                    sessionPrice,
                    a.isPaidUpfront(),
                    mapItemsToSummary(a),
                    paid,
                    paidLocked,
                    a.getNotes());
        });
    }

    /**
     * Maps the composition items of a package assignment to summary DTOs for the
     * admin agenda card. Returned list is sorted by position. Safe to call on
     * any assignment — returns an empty list when the items collection is null.
     */
    public List<PackageItemSummaryDTO> mapItemsToSummary(ClientPackageAssignment a) {
        if (a == null || a.getItems() == null || a.getItems().isEmpty()) {
            return List.of();
        }
        return a.getItems().stream()
                .sorted(Comparator.comparingInt(ClientPackageAssignmentItem::getPosition))
                .map(it -> {
                    ServiceItem svc = it.getService();
                    if (svc == null && it.getServiceOption() != null) {
                        svc = it.getServiceOption().getService();
                    }
                    return new PackageItemSummaryDTO(
                            it.getPosition(),
                            svc != null ? svc.getServiceId() : null,
                            svc != null ? svc.getTitle() : null,
                            it.getServiceOption() != null ? it.getServiceOption().getOptionId() : null,
                            it.getServiceOption() != null ? it.getServiceOption().getName() : null,
                            it.getCustomName()
                    );
                })
                .toList();
    }

    // ── Package persistence for admin booking integration ─────────────────────

    /**
     * Saves (insert or update) a ClientPackageAssignment entity directly.
     * Used by BookingService within its own SERIALIZABLE transaction to avoid
     * REQUIRES_NEW propagation issues.
     */
    @Transactional
    public ClientPackageAssignment saveAssignment(ClientPackageAssignment assignment) {
        return assignmentRepo.save(assignment);
    }

    // ── Package lookup for admin booking integration ──────────────────────────

    /**
     * Returns the first ACTIVE ClientPackageAssignment for the given client name, if any.
     * Used during admin booking creation (CASE B: update existing package session count).
     */
    @Transactional(readOnly = true)
    public Optional<ClientPackageAssignment> findFirstActiveAssignmentByClientName(String clientName) {
        return assignmentRepo.findByClientNameIgnoreCase(clientName)
                .stream()
                .filter(a -> a.getStatus() == ClientPackageStatus.ACTIVE)
                .findFirst();
    }

    /**
     * Returns ALL ACTIVE ClientPackageAssignments for the given client name.
     * Used in CASE B scoping: caller must filter by service to avoid picking the wrong package.
     */
    @Transactional(readOnly = true)
    public List<ClientPackageAssignment> findActiveAssignmentsByClientName(String clientName) {
        return assignmentRepo.findByClientNameIgnoreCase(clientName)
                .stream()
                .filter(a -> a.getStatus() == ClientPackageStatus.ACTIVE)
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ClientPackageAssignment requireAssignment(UUID id) {
        return assignmentRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ClientPackageAssignment not found: " + id));
    }

    ClientPackageAssignmentDTO toDTO(ClientPackageAssignment a) {
        // Service title: prefer direct service FK, fall back to serviceOption.service (legacy)
        String serviceTitle = a.getService() != null
                ? a.getService().getTitle()
                : (a.getServiceOption() != null && a.getServiceOption().getService() != null
                        ? a.getServiceOption().getService().getTitle()
                        : null);
        UUID serviceId = a.getService() != null
                ? a.getService().getServiceId()
                : (a.getServiceOption() != null && a.getServiceOption().getService() != null
                        ? a.getServiceOption().getService().getServiceId()
                        : null);
        // Display name preference order:
        //   1. customPackageName            (admin-entered name — always wins when present)
        //   2. service title · option name  (multi-line package's representative item)
        //   3. option name                  (option only)
        //   4. service title                (service only)
        //   5. fallback
        // Prior order put customPackageName last, which broke packages like
        // "Mani e piedi" whose representative items[0] had a service+option:
        // the admin's name was silently overridden by "Manicure · Smalto normale".
        String displayName;
        if (a.getCustomPackageName() != null && !a.getCustomPackageName().isBlank()) {
            displayName = a.getCustomPackageName();
        } else if (a.getServiceOption() != null && serviceTitle != null) {
            displayName = serviceTitle + " · " + a.getServiceOption().getName();
        } else if (a.getServiceOption() != null) {
            displayName = a.getServiceOption().getName();
        } else if (serviceTitle != null) {
            displayName = serviceTitle;
        } else {
            displayName = "Pacchetto senza nome";
        }
        List<ClientPackageAssignmentItemDTO> itemDTOs = a.getItems() == null
                ? List.of()
                : a.getItems().stream()
                        .sorted(Comparator.comparingInt(ClientPackageAssignmentItem::getPosition))
                        .map(this::toItemDTO)
                        .toList();
        return new ClientPackageAssignmentDTO(
                a.getId(),
                a.getClientName(),
                a.getServiceOption() != null ? a.getServiceOption().getOptionId() : null,
                a.getServiceOption() != null ? a.getServiceOption().getName() : null,
                serviceTitle,
                serviceId,
                a.getCustomPackageName(),
                displayName,
                a.getTotalSessions(),
                a.getSessionsRemaining(),
                a.getPricePaid(),
                a.getNotes(),
                a.getStatus(),
                a.getLinkedUser() != null ? a.getLinkedUser().getUserId() : null,
                a.getCreatedAt(),
                a.getUpdatedAt(),
                itemDTOs,
                a.getSessionDurationMin(),
                a.isPaidUpfront(),
                a.getStartSession(),
                a.getPaymentMode()
        );
    }

    private ClientPackageAssignmentItemDTO toItemDTO(ClientPackageAssignmentItem it) {
        ServiceItem svc = it.getService();
        if (svc == null && it.getServiceOption() != null) {
            svc = it.getServiceOption().getService();
        }
        return new ClientPackageAssignmentItemDTO(
                it.getId(),
                svc != null ? svc.getServiceId() : null,
                svc != null ? svc.getTitle() : null,
                it.getServiceOption() != null ? it.getServiceOption().getOptionId() : null,
                it.getServiceOption() != null ? it.getServiceOption().getName() : null,
                it.getCustomName(),
                it.getPosition()
        );
    }

    // ── Composition item builders ─────────────────────────────────────────────

    /**
     * Resolves the composition items collection for a creation request.
     * Priority:
     *   1. req.items() — source of truth when non-null and non-empty
     *   2. Legacy req.serviceOptionId() → single item at position 0
     *   3. Legacy req.customPackageName() → single custom item at position 0
     *   4. Fallback: single all-null item at position 0 (preserves the
     *      invariant "every package has >= 1 composition item")
     */
    private List<ClientPackageAssignmentItem> resolveItemsFromRequest(ClientPackageAssignmentRequestDTO req) {
        if (req.items() != null && !req.items().isEmpty()) {
            return buildItemsFromRequestList(req.items());
        }
        List<ClientPackageAssignmentItem> single = new ArrayList<>();
        ClientPackageAssignmentItem item = new ClientPackageAssignmentItem();
        item.setPosition(0);
        if (req.serviceOptionId() != null) {
            ServiceOption opt = serviceOptionRepo.findById(req.serviceOptionId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "ServiceOption not found: " + req.serviceOptionId()));
            item.setServiceOption(opt);
            if (opt.getService() != null) {
                item.setService(opt.getService());
            }
        } else if (req.customPackageName() != null && !req.customPackageName().isBlank()) {
            item.setCustomName(req.customPackageName().trim());
        }
        single.add(item);
        return single;
    }

    /**
     * Materialises composition items from request DTOs, sorted by position.
     * Each item resolves to (service, serviceOption, customName); free-form
     * lines without any catalog reference are accepted as custom-only.
     */
    private List<ClientPackageAssignmentItem> buildItemsFromRequestList(List<ClientPackageAssignmentItemRequestDTO> reqs) {
        List<ClientPackageAssignmentItemRequestDTO> sorted = new ArrayList<>(reqs);
        sorted.sort(Comparator.comparingInt(ClientPackageAssignmentItemRequestDTO::position));
        List<ClientPackageAssignmentItem> built = new ArrayList<>(sorted.size());
        for (int i = 0; i < sorted.size(); i++) {
            ClientPackageAssignmentItemRequestDTO it = sorted.get(i);
            ClientPackageAssignmentItem entity = new ClientPackageAssignmentItem();
            entity.setPosition(it.position());

            if (it.serviceOptionId() != null) {
                ServiceOption opt = serviceOptionRepo.findById(it.serviceOptionId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "ServiceOption not found: " + it.serviceOptionId()));
                entity.setServiceOption(opt);
                ServiceItem svc = opt.getService();
                // Explicit service override on the item: prefer it over option.service
                if (it.serviceId() != null) {
                    svc = serviceItemRepo.findById(it.serviceId())
                            .orElseThrow(() -> new ResourceNotFoundException(
                                    "ServiceItem not found: " + it.serviceId()));
                }
                entity.setService(svc);
            } else if (it.serviceId() != null) {
                ServiceItem svc = serviceItemRepo.findById(it.serviceId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "ServiceItem not found: " + it.serviceId()));
                entity.setService(svc);
            }

            if (it.customName() != null && !it.customName().isBlank()) {
                entity.setCustomName(it.customName().trim());
            }

            built.add(entity);
        }
        return built;
    }

    private static Integer normalizePositive(Integer value) {
        if (value == null) return null;
        return value > 0 ? value : null;
    }

    /**
     * Builds a single composition item that mirrors the parent's representative
     * (service / serviceOption / customPackageName). Used by the legacy update
     * path so items[0] stays in sync with the parent even when callers do not
     * pass items[]. Matches the V59 backfill fallback exactly: when neither a
     * service nor an option nor a non-blank custom_package_name is available,
     * customName falls back to 'Pacchetto' so the item always renders as
     * something readable.
     */
    private ClientPackageAssignmentItem buildMirrorItemFromParent(ClientPackageAssignment a) {
        ClientPackageAssignmentItem item = new ClientPackageAssignmentItem();
        item.setPosition(0);
        item.setServiceOption(a.getServiceOption());
        if (a.getServiceOption() != null && a.getServiceOption().getService() != null) {
            item.setService(a.getServiceOption().getService());
        } else if (a.getService() != null) {
            item.setService(a.getService());
        }
        if (item.getService() == null && item.getServiceOption() == null) {
            String custom = a.getCustomPackageName();
            item.setCustomName(custom != null && !custom.isBlank() ? custom.trim() : "Pacchetto");
        }
        return item;
    }

    BookingPackageLinkDTO toLinkDTO(BookingPackageLink l) {
        return new BookingPackageLinkDTO(
                l.getId(),
                l.getBooking().getBookingId(),
                l.getAssignment().getId(),
                l.getAssignment().getClientName(),
                l.getLinkedAt()
        );
    }
}
