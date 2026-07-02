package daviderocca.beautyroom.personalappointments;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/personal-appointments")
@PreAuthorize("hasAnyRole('ADMIN','STAFF')")
@RequiredArgsConstructor
@Slf4j
public class PersonalAppointmentController {

    private final PersonalAppointmentService service;

    // POST /admin/personal-appointments — create
    @PostMapping
    public ResponseEntity<PersonalAppointmentDTO> create(
            @Valid @RequestBody PersonalAppointmentRequestDTO req) {
        log.info("ADMIN | create personal appointment: {}", req.title());
        PersonalAppointmentDTO created = service.create(req);
        return ResponseEntity
                .created(URI.create("/admin/personal-appointments/" + created.id()))
                .body(created);
    }

    // GET /admin/personal-appointments?date=YYYY-MM-DD — find by day
    @GetMapping
    public ResponseEntity<List<PersonalAppointmentDTO>> findByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        log.info("ADMIN | personal appointments day={}", date);
        return ResponseEntity.ok(service.findByDate(date));
    }

    // GET /admin/personal-appointments/week?start=YYYY-MM-DD — find by week (start → start+6)
    @GetMapping("/week")
    public ResponseEntity<List<PersonalAppointmentDTO>> findByWeek(
            @RequestParam("start") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        log.info("ADMIN | personal appointments week start={}", weekStart);
        return ResponseEntity.ok(service.findByWeek(weekStart));
    }

    // PUT /admin/personal-appointments/{id} — update
    @PutMapping("/{id}")
    public ResponseEntity<PersonalAppointmentDTO> update(
            @PathVariable UUID id,
            @Valid @RequestBody PersonalAppointmentRequestDTO req) {
        log.info("ADMIN | update personal appointment id={}", id);
        return ResponseEntity.ok(service.update(id, req));
    }

    // DELETE /admin/personal-appointments/{id} — delete (204 No Content)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        log.info("ADMIN | delete personal appointment id={}", id);
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
