package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.DTO.bookingDTOs.PackageSummaryDTO;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.ClientPackageStatus;
import daviderocca.beautyroom.exceptions.BadRequestException;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
        assignment.setClientName(req.clientName().trim());
        assignment.setTotalSessions(req.totalSessions());
        assignment.setPricePaid(req.pricePaid());
        assignment.setNotes(req.notes() != null ? req.notes().trim() : null);
        assignment.setCustomPackageName(req.customPackageName() != null ? req.customPackageName().trim() : null);

        if (req.serviceOptionId() != null) {
            ServiceOption option = serviceOptionRepo.findById(req.serviceOptionId())
                    .orElseThrow(() -> new ResourceNotFoundException("ServiceOption not found: " + req.serviceOptionId()));
            assignment.setServiceOption(option);
        } else {
            assignment.setServiceOption(null);
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
            String name = a.getCustomPackageName() != null
                    ? a.getCustomPackageName()
                    : (a.getServiceOption() != null ? a.getServiceOption().getName() : a.getClientName());
            return new PackageSummaryDTO(name, a.getSessionsRemaining());
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ClientPackageAssignment requireAssignment(UUID id) {
        return assignmentRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ClientPackageAssignment not found: " + id));
    }

    ClientPackageAssignmentDTO toDTO(ClientPackageAssignment a) {
        String displayName = (a.getCustomPackageName() != null && !a.getCustomPackageName().isBlank())
                ? a.getCustomPackageName()
                : (a.getServiceOption() != null ? a.getServiceOption().getName() : "Pacchetto senza nome");
        return new ClientPackageAssignmentDTO(
                a.getId(),
                a.getClientName(),
                a.getServiceOption() != null ? a.getServiceOption().getOptionId() : null,
                a.getServiceOption() != null ? a.getServiceOption().getName() : null,
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
