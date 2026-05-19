package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.DTO.bookingDTOs.PackageSummaryDTO;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import java.math.BigDecimal;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.ClientPackageStatus;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.DuplicateResourceException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.linking.LinkingOutcome;
import daviderocca.beautyroom.linking.UserLookupService;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

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
    private final BookingRepository bookingRepository;
    private final UserLookupService userLookupService;

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public ClientPackageAssignmentDTO create(ClientPackageAssignmentRequestDTO req) {
        // Guard: reject exact duplicates (same client name + same service option while ACTIVE)
        if (req.serviceOptionId() != null) {
            boolean alreadyActive = assignmentRepo.findByClientNameIgnoreCase(req.clientName().trim())
                    .stream()
                    .anyMatch(a -> a.getStatus() == ClientPackageStatus.ACTIVE
                            && a.getServiceOption() != null
                            && a.getServiceOption().getOptionId().equals(req.serviceOptionId()));
            if (alreadyActive) {
                throw new DuplicateResourceException(
                        "Questa cliente ha già un pacchetto attivo per questo trattamento con questa opzione.");
            }
        }

        ClientPackageAssignment assignment = new ClientPackageAssignment();
        assignment.setClientName(req.clientName().trim());
        assignment.setTotalSessions(req.totalSessions());
        assignment.setSessionsRemaining(req.totalSessions());
        assignment.setPricePaid(req.pricePaid());
        assignment.setNotes(req.notes() != null ? req.notes().trim() : null);
        assignment.setCustomPackageName(req.customPackageName() != null ? req.customPackageName().trim() : null);
        assignment.setStatus(ClientPackageStatus.ACTIVE);

        if (req.serviceOptionId() != null) {
            ServiceOption option = serviceOptionRepo.findById(req.serviceOptionId())
                    .orElseThrow(() -> new ResourceNotFoundException("ServiceOption not found: " + req.serviceOptionId()));
            assignment.setServiceOption(option);
            // Derive direct service FK from the option so option-less code paths still work
            if (option.getService() != null) {
                assignment.setService(option.getService());
            }
        }

        // Explicit linked user override (admin can pre-link)
        if (req.linkedUserId() != null) {
            User user = userLookupService.findById(req.linkedUserId());
            assignment.setLinkedUser(user);
        } else {
            // Auto-link by name (best-effort)
            try {
                LinkingOutcome outcome = userLookupService.tryLink(req.clientName());
                if (outcome.user() != null) {
                    assignment.setLinkedUser(outcome.user());
                }
            } catch (Exception e) {
                log.warn("Auto-link failed for assignment clientName='{}': {}", req.clientName(), e.getMessage());
            }
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

        if (req.linkedUserId() != null) {
            User user = userLookupService.findById(req.linkedUserId());
            assignment.setLinkedUser(user);
        }

        return toDTO(assignmentRepo.save(assignment));
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
            BigDecimal sessionPrice = null;
            if (a.getServiceOption() != null && a.getServiceOption().getPrice() != null) {
                sessionPrice = a.getServiceOption().getPrice();
            } else if (svc != null && svc.getPrice() != null) {
                sessionPrice = svc.getPrice();
            }
            return new PackageSummaryDTO(a.getId(), name, a.getSessionsRemaining(), sessionPrice);
        });
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
        //   1. service title · option name  (catalog with option)
        //   2. service title                (catalog without option)
        //   3. customPackageName            (truly custom free-form package)
        //   4. fallback
        String displayName;
        if (a.getServiceOption() != null && serviceTitle != null) {
            displayName = serviceTitle + " · " + a.getServiceOption().getName();
        } else if (a.getServiceOption() != null) {
            displayName = a.getServiceOption().getName();
        } else if (serviceTitle != null) {
            displayName = serviceTitle;
        } else if (a.getCustomPackageName() != null && !a.getCustomPackageName().isBlank()) {
            displayName = a.getCustomPackageName();
        } else {
            displayName = "Pacchetto senza nome";
        }
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
                a.getUpdatedAt()
        );
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
