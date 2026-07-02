package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.staffDTOs.NewStaffMemberDTO;
import daviderocca.beautyroom.DTO.staffDTOs.StaffActiveUpdateDTO;
import daviderocca.beautyroom.DTO.staffDTOs.StaffMemberResponseDTO;
import daviderocca.beautyroom.DTO.staffDTOs.StaffServiceIdsDTO;
import daviderocca.beautyroom.DTO.staffDTOs.UpdateStaffMemberDTO;
import daviderocca.beautyroom.DTO.workingHoursDTOs.NewWorkingHoursDTO;
import daviderocca.beautyroom.DTO.workingHoursDTOs.WorkingHoursResponseDTO;
import daviderocca.beautyroom.services.StaffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Team management API (multi-staff prompt 03) — owner-only (matrix row 28).
 * No hard-delete endpoint by design: staff are deactivated, never removed.
 */
@RestController
@RequestMapping("/admin/staff")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class StaffController {

    private final StaffService staffService;

    // --------------------- STAFF CRUD ---------------------

    @GetMapping
    public ResponseEntity<List<StaffMemberResponseDTO>> getAllStaff() {
        log.info("ADMIN | staff list");
        return ResponseEntity.ok(staffService.findAllStaff());
    }

    @PostMapping
    public ResponseEntity<StaffMemberResponseDTO> createStaff(@Valid @RequestBody NewStaffMemberDTO payload) {
        log.info("ADMIN | create staff displayName={}", payload.displayName());
        return ResponseEntity.status(201).body(staffService.createStaff(payload));
    }

    @PutMapping("/{id}")
    public ResponseEntity<StaffMemberResponseDTO> updateStaff(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStaffMemberDTO payload
    ) {
        log.info("ADMIN | update staff id={}", id);
        return ResponseEntity.ok(staffService.updateStaff(id, payload));
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<StaffMemberResponseDTO> setActive(
            @PathVariable UUID id,
            @Valid @RequestBody StaffActiveUpdateDTO payload
    ) {
        log.info("ADMIN | staff id={} active={}", id, payload.active());
        return ResponseEntity.ok(staffService.setActive(id, payload.active()));
    }

    // --------------------- SERVICE ASSIGNMENTS ---------------------

    @GetMapping("/{id}/services")
    public ResponseEntity<StaffServiceIdsDTO> getServices(@PathVariable UUID id) {
        log.info("ADMIN | staff services id={}", id);
        return ResponseEntity.ok(new StaffServiceIdsDTO(staffService.findServiceIds(id)));
    }

    @PutMapping("/{id}/services")
    public ResponseEntity<StaffServiceIdsDTO> replaceServices(
            @PathVariable UUID id,
            @Valid @RequestBody StaffServiceIdsDTO payload
    ) {
        log.info("ADMIN | replace staff services id={} count={}", id, payload.serviceIds().size());
        return ResponseEntity.ok(new StaffServiceIdsDTO(staffService.replaceServices(id, payload.serviceIds())));
    }

    // --------------------- WORKING HOURS ---------------------

    @GetMapping("/{id}/working-hours")
    public ResponseEntity<List<WorkingHoursResponseDTO>> getWorkingHours(@PathVariable UUID id) {
        log.info("ADMIN | staff working-hours id={}", id);
        return ResponseEntity.ok(staffService.findWorkingHours(id));
    }

    @PutMapping("/{id}/working-hours")
    public ResponseEntity<List<WorkingHoursResponseDTO>> updateWorkingHours(
            @PathVariable UUID id,
            @RequestBody List<NewWorkingHoursDTO> payloads
    ) {
        log.info("ADMIN | update staff working-hours id={} days={}", id, payloads != null ? payloads.size() : 0);
        return ResponseEntity.ok(staffService.updateWorkingHours(id, payloads));
    }
}
