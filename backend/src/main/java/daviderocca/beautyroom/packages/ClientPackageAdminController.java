package daviderocca.beautyroom.packages;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/package-assignments")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class ClientPackageAdminController {

    private final ClientPackageService service;

    // POST /admin/package-assignments — create new assignment
    @PostMapping
    public ResponseEntity<ClientPackageAssignmentDTO> create(
            @Valid @RequestBody ClientPackageAssignmentRequestDTO req) {
        log.info("ADMIN | create package assignment for '{}'", req.clientName());
        ClientPackageAssignmentDTO created = service.create(req);
        return ResponseEntity
                .created(URI.create("/admin/package-assignments/" + created.id()))
                .body(created);
    }

    // GET /admin/package-assignments — list all
    @GetMapping
    public ResponseEntity<List<ClientPackageAssignmentDTO>> findAll() {
        return ResponseEntity.ok(service.findAll());
    }

    // GET /admin/package-assignments/{id} — get one
    @GetMapping("/{id}")
    public ResponseEntity<ClientPackageAssignmentDTO> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    // GET /admin/package-assignments/by-user/{userId} — get by user
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<List<ClientPackageAssignmentDTO>> findByUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(service.findByUserId(userId));
    }

    // PUT /admin/package-assignments/{id} — update
    @PutMapping("/{id}")
    public ResponseEntity<ClientPackageAssignmentDTO> update(
            @PathVariable UUID id,
            @Valid @RequestBody ClientPackageAssignmentRequestDTO req) {
        log.info("ADMIN | update package assignment id={}", id);
        return ResponseEntity.ok(service.update(id, req));
    }

    // DELETE /admin/package-assignments/{id}/cancel — soft cancel
    @DeleteMapping("/{id}/cancel")
    public ResponseEntity<ClientPackageAssignmentDTO> cancel(@PathVariable UUID id) {
        log.info("ADMIN | cancel package assignment id={}", id);
        return ResponseEntity.ok(service.cancel(id));
    }

    // GET /admin/package-assignments/client?name= — find active packages by client name
    @GetMapping("/client")
    public ResponseEntity<List<ClientPackageAssignmentDTO>> findByClientName(
            @RequestParam String name) {
        log.info("ADMIN | search active packages for client name='{}'", name);
        return ResponseEntity.ok(service.findActiveByClientName(name));
    }

    // POST /admin/package-assignments/link-booking — link a booking to an assignment
    @PostMapping("/link-booking")
    public ResponseEntity<BookingPackageLinkDTO> linkBooking(
            @Valid @RequestBody LinkBookingRequestDTO req) {
        log.info("ADMIN | link bookingId={} to assignmentId={}", req.bookingId(), req.assignmentId());
        return ResponseEntity.ok(service.linkBooking(req));
    }

    // POST /admin/package-assignments/recalculate-all — one-time data-fix endpoint
    @PostMapping("/recalculate-all")
    public ResponseEntity<String> recalculateAll() {
        log.info("ADMIN | recalculate-all package sessions triggered");
        int count = service.recalculateAllPackageSessions();
        return ResponseEntity.ok("Recalculated " + count + " package assignments.");
    }
}
