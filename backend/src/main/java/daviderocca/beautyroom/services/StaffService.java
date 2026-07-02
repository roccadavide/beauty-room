package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.staffDTOs.BlockingBookingDTO;
import daviderocca.beautyroom.DTO.staffDTOs.NewStaffMemberDTO;
import daviderocca.beautyroom.DTO.staffDTOs.PublicStaffDTO;
import daviderocca.beautyroom.DTO.staffDTOs.StaffMemberResponseDTO;
import daviderocca.beautyroom.DTO.staffDTOs.UpdateStaffMemberDTO;
import daviderocca.beautyroom.DTO.workingHoursDTOs.NewWorkingHoursDTO;
import daviderocca.beautyroom.DTO.workingHoursDTOs.WorkingHoursResponseDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.exceptions.StaffDeactivationBlockedException;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ServiceItemRepository;
import daviderocca.beautyroom.staff.StaffMember;
import daviderocca.beautyroom.staff.StaffMemberRepository;
import daviderocca.beautyroom.staff.StaffWorkingHours;
import daviderocca.beautyroom.staff.StaffWorkingHoursRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Team API (multi-staff prompt 03): staff CRUD, service assignments, per-staff
 * working hours and the public active-staff list. Owner-only via StaffController.
 * Inert until prompt 04's UI (I1: with no API consumer, behavior is unchanged).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class StaffService {

    private final StaffMemberRepository staffMemberRepository;
    private final StaffWorkingHoursRepository staffWorkingHoursRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final BookingRepository bookingRepository;
    private final UserService userService;
    private final WorkingHoursService workingHoursService;

    // ---------------------------- FIND ----------------------------

    @Transactional(readOnly = true)
    public List<StaffMemberResponseDTO> findAllStaff() {
        return staffMemberRepository.findAllWithDetails().stream()
                .map(this::convertToDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public StaffMember findStaffById(UUID staffId) {
        return staffMemberRepository.findById(staffId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro del team non trovato con id: " + staffId));
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public StaffMemberResponseDTO createStaff(NewStaffMemberDTO payload) {
        String displayName = payload.displayName().trim();

        // users.name/surname are NOT NULL — derive them from the display name.
        String[] parts = displayName.split("\\s+", 2);
        String name = truncate(parts[0], 50);
        String surname = truncate(parts.length > 1 ? parts[1] : "Staff", 50);

        // Same transaction: a failure on either side rolls back both (atomicity).
        User staffUser = userService.createStaffUser(name, surname, payload.email(), payload.password(), payload.phone());

        StaffMember staff = new StaffMember(displayName, true, nextSortOrder());
        staff.setUser(staffUser);
        staff.setColor(payload.color());

        StaffMember saved = staffMemberRepository.save(staff);
        log.info("Membro del team '{}' creato (staffId={}, userEmail={})",
                saved.getDisplayName(), saved.getId(), staffUser.getEmail());
        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE ----------------------------

    @Transactional
    public StaffMemberResponseDTO updateStaff(UUID staffId, UpdateStaffMemberDTO payload) {
        StaffMember staff = findStaffById(staffId);

        staff.setDisplayName(payload.displayName().trim());
        staff.setColor(payload.color());
        staff.setSortOrder(payload.sortOrder());

        StaffMember updated = staffMemberRepository.save(staff);
        log.info("Membro del team {} aggiornato", updated.getId());
        return convertToDTO(updated);
    }

    // ---------------------------- ACTIVE TOGGLE (decision #10) ----------------------------

    @Transactional
    public StaffMemberResponseDTO setActive(UUID staffId, boolean active) {
        StaffMember staff = findStaffById(staffId);

        // Deactivation is blocked while future CONFIRMED bookings exist for this
        // staff — the 409 carries the list so the UI can reassign them first.
        // Reactivation is always allowed.
        if (!active) {
            List<Booking> blocking = bookingRepository.findByStaffAndStatusStartingFrom(
                    staffId, BookingStatus.CONFIRMED, LocalDateTime.now());
            if (!blocking.isEmpty()) {
                List<BlockingBookingDTO> infos = blocking.stream()
                        .map(b -> new BlockingBookingDTO(b.getBookingId(), b.getStartTime(), b.getCustomerName()))
                        .toList();
                throw new StaffDeactivationBlockedException(
                        "Impossibile disattivare: ci sono " + infos.size()
                                + " appuntamenti futuri confermati da riassegnare.", infos);
            }
        }

        staff.setActive(active);
        StaffMember updated = staffMemberRepository.save(staff);
        log.info("Membro del team {} active={}", updated.getId(), active);
        return convertToDTO(updated);
    }

    // ---------------------------- SERVICE ASSIGNMENTS (R4) ----------------------------

    @Transactional(readOnly = true)
    public List<UUID> findServiceIds(UUID staffId) {
        StaffMember staff = staffMemberRepository.findByIdWithServices(staffId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro del team non trovato con id: " + staffId));
        return staff.getServices().stream()
                .map(ServiceItem::getServiceId)
                .sorted()
                .toList();
    }

    /** Replace-set semantics on staff_services: the given list becomes the whole set. */
    @Transactional
    public List<UUID> replaceServices(UUID staffId, List<UUID> serviceIds) {
        StaffMember staff = staffMemberRepository.findByIdWithServices(staffId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro del team non trovato con id: " + staffId));

        Set<UUID> requested = new HashSet<>(serviceIds);
        List<ServiceItem> found = serviceItemRepository.findAllById(requested);
        if (found.size() != requested.size()) {
            Set<UUID> missing = new HashSet<>(requested);
            found.forEach(s -> missing.remove(s.getServiceId()));
            throw new ResourceNotFoundException("Servizi non trovati: " + missing);
        }

        staff.getServices().clear();
        staff.getServices().addAll(found);
        staffMemberRepository.save(staff);
        log.info("Servizi del membro del team {} sostituiti: {} assegnazioni", staffId, found.size());
        return findServiceIds(staffId);
    }

    // ---------------------------- WORKING HOURS (R5) ----------------------------

    @Transactional(readOnly = true)
    public List<WorkingHoursResponseDTO> findWorkingHours(UUID staffId) {
        findStaffById(staffId); // 404 on unknown staff
        return staffWorkingHoursRepository.findByStaffMember_Id(staffId).stream()
                .sorted(Comparator.comparing(StaffWorkingHours::getDayOfWeek))
                .map(this::convertHoursToDTO)
                .toList();
    }

    /**
     * Upsert per day. §3.5 dual-write shim: when {id} is the OWNER's staff row,
     * every day is also mirrored into the legacy working_hours table so the two
     * editors stay consistent until the engine flips in prompt 06.
     */
    @Transactional
    public List<WorkingHoursResponseDTO> updateWorkingHours(UUID staffId, List<NewWorkingHoursDTO> payloads) {
        StaffMember staff = findStaffById(staffId);

        if (payloads == null || payloads.isEmpty()) {
            throw new BadRequestException("Specificare almeno un giorno.");
        }
        Set<DayOfWeek> seen = EnumSet.noneOf(DayOfWeek.class);
        for (NewWorkingHoursDTO payload : payloads) {
            workingHoursService.validatePayload(payload);
            if (!seen.add(payload.dayOfWeek())) {
                throw new BadRequestException("Giorno duplicato nel payload: " + payload.dayOfWeek());
            }
        }

        boolean ownerRow = staff.getUser() != null && staff.getUser().getRole() == Role.ADMIN;

        for (NewWorkingHoursDTO payload : payloads) {
            StaffWorkingHours row = staffWorkingHoursRepository
                    .findByStaffMember_IdAndDayOfWeek(staffId, payload.dayOfWeek())
                    .orElseGet(() -> {
                        StaffWorkingHours fresh = new StaffWorkingHours();
                        fresh.setStaffMember(staff);
                        fresh.setDayOfWeek(payload.dayOfWeek());
                        return fresh;
                    });
            applyHoursPayload(row, payload);
            staffWorkingHoursRepository.save(row);

            if (ownerRow) {
                workingHoursService.upsertDayFromStaffMirror(payload);
            }
        }

        log.info("Orari del membro del team {} aggiornati ({} giorni{})",
                staffId, payloads.size(), ownerRow ? ", mirror legacy" : "");
        return findWorkingHours(staffId);
    }

    // ---------------------------- PUBLIC LIST ----------------------------

    /** Active staff for the public booking flow, optionally filtered by qualification. */
    @Transactional(readOnly = true)
    public List<PublicStaffDTO> findPublicActiveStaff(UUID serviceId) {
        List<StaffMember> active = (serviceId == null)
                ? staffMemberRepository.findByActiveTrueOrderBySortOrderAsc()
                : staffMemberRepository.findActiveByServiceIdOrderBySortOrderAsc(serviceId);
        return active.stream()
                .map(s -> new PublicStaffDTO(s.getId(), s.getDisplayName(), s.getColor(), s.getSortOrder()))
                .toList();
    }

    // ---------------------------- HELPERS / CONVERTERS ----------------------------

    private int nextSortOrder() {
        return staffMemberRepository.findAll().stream()
                .mapToInt(StaffMember::getSortOrder)
                .max()
                .orElse(-1) + 1;
    }

    private String truncate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private void applyHoursPayload(StaffWorkingHours row, NewWorkingHoursDTO payload) {
        row.setClosed(payload.closed());
        if (payload.closed()) {
            row.setMorningStart(null);
            row.setMorningEnd(null);
            row.setAfternoonStart(null);
            row.setAfternoonEnd(null);
        } else {
            row.setMorningStart(payload.morningStart());
            row.setMorningEnd(payload.morningEnd());
            row.setAfternoonStart(payload.afternoonStart());
            row.setAfternoonEnd(payload.afternoonEnd());
        }
    }

    private WorkingHoursResponseDTO convertHoursToDTO(StaffWorkingHours row) {
        return new WorkingHoursResponseDTO(
                row.getId(),
                row.getDayOfWeek(),
                row.getMorningStart(),
                row.getMorningEnd(),
                row.getAfternoonStart(),
                row.getAfternoonEnd(),
                row.isClosed()
        );
    }

    private StaffMemberResponseDTO convertToDTO(StaffMember staff) {
        return new StaffMemberResponseDTO(
                staff.getId(),
                staff.getDisplayName(),
                staff.getColor(),
                staff.isActive(),
                staff.getSortOrder(),
                staff.getUser() != null ? staff.getUser().getEmail() : null,
                staff.getServices().stream().map(ServiceItem::getServiceId).sorted().toList()
        );
    }
}
