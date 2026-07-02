package daviderocca.beautyroom.personalappointments;

import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.exceptions.UnauthorizedOperationException;
import daviderocca.beautyroom.staff.CurrentStaffService;
import daviderocca.beautyroom.staff.DefaultStaffResolver;
import daviderocca.beautyroom.staff.StaffMember;
import daviderocca.beautyroom.staff.StaffMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PersonalAppointmentService {

    private final PersonalAppointmentRepository repo;
    // Multi-staff prompt 01: every personal appointment carries a staff member.
    private final DefaultStaffResolver defaultStaffResolver;
    // Multi-staff prompt 03: explicit staffId + own-only guard for STAFF (matrix row 10).
    private final CurrentStaffService currentStaffService;
    private final StaffMemberRepository staffMemberRepository;

    @Transactional
    public PersonalAppointmentDTO create(PersonalAppointmentRequestDTO req, User currentUser) {
        PersonalAppointment entity = new PersonalAppointment();
        applyScalars(entity, req);
        entity.setStaffMember(resolveTargetStaff(req.staffId(), currentUser, null));
        return toDTO(repo.save(entity));
    }

    @Transactional
    public PersonalAppointmentDTO update(UUID id, PersonalAppointmentRequestDTO req, User currentUser) {
        PersonalAppointment entity = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Appuntamento personale non trovato: " + id));
        // STAFF may only touch their own rows (owner may touch any).
        assertCanWriteFor(entity.getStaffMember(), currentUser);
        applyScalars(entity, req);
        entity.setStaffMember(resolveTargetStaff(req.staffId(), currentUser, entity.getStaffMember()));
        return toDTO(repo.save(entity));
    }

    @Transactional
    public void delete(UUID id, User currentUser) {
        PersonalAppointment entity = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Appuntamento personale non trovato: " + id));
        assertCanWriteFor(entity.getStaffMember(), currentUser);
        repo.delete(entity);
    }

    /** Legacy signature kept for internal callers (AdminAgendaDayController): no staff filter. */
    @Transactional(readOnly = true)
    public List<PersonalAppointmentDTO> findByDate(LocalDate date) {
        return findByDate(date, null);
    }

    @Transactional(readOnly = true)
    public List<PersonalAppointmentDTO> findByDate(LocalDate date, UUID staffId) {
        List<PersonalAppointment> rows = (staffId == null)
                ? repo.findByAppointmentDateOrderByStartTime(date)
                : repo.findByAppointmentDateAndStaffMember_IdOrderByStartTime(date, staffId);
        return rows.stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public List<PersonalAppointmentDTO> findByWeek(LocalDate weekStart, UUID staffId) {
        LocalDate weekEnd = weekStart.plusDays(6);
        List<PersonalAppointment> rows = (staffId == null)
                ? repo.findByAppointmentDateBetweenOrderByAppointmentDateAscStartTimeAsc(weekStart, weekEnd)
                : repo.findByAppointmentDateBetweenAndStaffMember_IdOrderByAppointmentDateAscStartTimeAsc(
                        weekStart, weekEnd, staffId);
        return rows.stream().map(this::toDTO).toList();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void applyScalars(PersonalAppointment entity, PersonalAppointmentRequestDTO req) {
        entity.setTitle(req.title().trim());
        entity.setNotes(req.notes() != null ? req.notes().trim() : null);
        entity.setAppointmentDate(req.appointmentDate());
        entity.setStartTime(req.startTime());
        entity.setDurationMinutes(req.durationMinutes());
    }

    /**
     * Prompt 03 resolution chain: explicit staffId (guarded) → the row's existing
     * staff (updates) → the caller's own staff row → DefaultStaffResolver
     * (single-active / owner fallback from prompt 01).
     */
    private StaffMember resolveTargetStaff(UUID requestedStaffId, User currentUser, StaffMember existing) {
        if (requestedStaffId != null) {
            StaffMember target = staffMemberRepository.findById(requestedStaffId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Membro del team non trovato con id: " + requestedStaffId));
            assertCanWriteFor(target, currentUser);
            return target;
        }
        if (existing != null) return existing;
        if (currentUser != null) {
            StaffMember own = currentStaffService.resolveFor(currentUser).orElse(null);
            if (own != null) return own;
        }
        return defaultStaffResolver.resolveDefault();
    }

    /**
     * Matrix row 10: STAFF writes only their own personal appointments; the owner
     * (ADMIN) writes any. Rows without staff (pre-backfill legacy) are unrestricted.
     */
    private void assertCanWriteFor(StaffMember target, User currentUser) {
        if (currentUser == null || currentUser.getRole() != Role.STAFF) return;
        if (target == null) return;
        UUID ownStaffId = currentStaffService.resolveFor(currentUser)
                .map(StaffMember::getId)
                .orElse(null);
        if (ownStaffId == null || !ownStaffId.equals(target.getId())) {
            throw new UnauthorizedOperationException(
                    "Puoi gestire solo i tuoi appuntamenti personali.");
        }
    }

    PersonalAppointmentDTO toDTO(PersonalAppointment e) {
        return new PersonalAppointmentDTO(
                e.getId(),
                e.getTitle(),
                e.getNotes(),
                e.getAppointmentDate(),
                e.getStartTime(),
                e.getDurationMinutes(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                // LAZY proxy: id access never initializes it
                e.getStaffMember() != null ? e.getStaffMember().getId() : null
        );
    }
}
