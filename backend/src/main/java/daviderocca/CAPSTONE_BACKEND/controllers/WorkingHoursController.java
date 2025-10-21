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
public class WorkingHoursController {

    private final WorkingHoursService workingHoursService;

    // --------------------- GET ---------------------

    @GetMapping
    public ResponseEntity<List<WorkingHoursResponseDTO>> getAll() {
        log.info("Richiesta elenco orari di lavoro");
        List<WorkingHoursResponseDTO> list = workingHoursService.findAll();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkingHoursResponseDTO> getById(@PathVariable UUID id) {
        log.info("Richiesta orario di lavoro con id {}", id);
        return ResponseEntity.ok(workingHoursService.findByIdAndConvert(id));
    }

    @GetMapping("/day/{day}")
    public ResponseEntity<WorkingHoursResponseDTO> getByDay(@PathVariable DayOfWeek day) {
        log.info("Richiesta orario di lavoro per il giorno {}", day);
        return ResponseEntity.ok(workingHoursService.findByDayOfWeek(day));
    }

    // --------------------- POST ---------------------

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<WorkingHoursResponseDTO> createWorkingHours(
            @Valid @RequestBody NewWorkingHoursDTO payload
    ) {
        log.info("🆕 Creazione nuovo orario per {}", payload.dayOfWeek());
        WorkingHoursResponseDTO created = workingHoursService.createWorkingHours(payload);
        return ResponseEntity.status(201).body(created);
    }

    // --------------------- PUT ---------------------

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<WorkingHoursResponseDTO> updateWorkingHours(
            @PathVariable UUID id,
            @Valid @RequestBody NewWorkingHoursDTO payload
    ) {
        log.info("Aggiornamento orario con id {}", id);
        WorkingHoursResponseDTO updated = workingHoursService.updateWorkingHours(id, payload);
        return ResponseEntity.ok(updated);
    }

    // --------------------- DELETE ---------------------

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteWorkingHours(@PathVariable UUID id) {
        log.info("Eliminazione orario con id {}", id);
        workingHoursService.deleteWorkingHours(id);
        return ResponseEntity.noContent().build();
    }
}