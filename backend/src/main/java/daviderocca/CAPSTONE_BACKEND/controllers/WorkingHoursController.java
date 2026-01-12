package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.workingHoursDTOs.NewWorkingHoursDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.workingHoursDTOs.WorkingHoursResponseDTO;
import daviderocca.CAPSTONE_BACKEND.services.WorkingHoursService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/working-hours")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ADMIN')")
public class WorkingHoursController {

    private final WorkingHoursService workingHoursService;

    // --------------------- GET ---------------------

    @GetMapping
    public ResponseEntity<List<WorkingHoursResponseDTO>> getAll() {
        log.info("ADMIN | working-hours list");
        return ResponseEntity.ok(workingHoursService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkingHoursResponseDTO> getById(@PathVariable UUID id) {
        log.info("ADMIN | working-hours id={}", id);
        return ResponseEntity.ok(workingHoursService.findByIdAndConvert(id));
    }

    @GetMapping("/day/{day}")
    public ResponseEntity<WorkingHoursResponseDTO> getByDay(@PathVariable DayOfWeek day) {
        log.info("ADMIN | working-hours day={}", day);
        return ResponseEntity.ok(workingHoursService.findByDayOfWeek(day));
    }

    // --------------------- POST ---------------------

    @PostMapping
    public ResponseEntity<WorkingHoursResponseDTO> createWorkingHours(@Valid @RequestBody NewWorkingHoursDTO payload) {
        log.info("ADMIN | create working-hours day={}", payload.dayOfWeek());
        return ResponseEntity.status(201).body(workingHoursService.createWorkingHours(payload));
    }

    @PostMapping("/init-default-week")
    public ResponseEntity<List<WorkingHoursResponseDTO>> initDefaultWeek() {
        log.info("ADMIN | init default week working-hours");
        return ResponseEntity.status(201).body(workingHoursService.initDefaultWeekIfMissing());
    }

    // --------------------- PUT ---------------------

    @PutMapping("/{id}")
    public ResponseEntity<WorkingHoursResponseDTO> updateWorkingHours(
            @PathVariable UUID id,
            @Valid @RequestBody NewWorkingHoursDTO payload
    ) {
        log.info("ADMIN | update working-hours id={}", id);
        return ResponseEntity.ok(workingHoursService.updateWorkingHours(id, payload));
    }
}