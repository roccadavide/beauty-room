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
@RequestMapping("/admin/package-assignments/{assignmentId}/installments")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class PackageInstallmentAdminController {

    private final PackageInstallmentService service;

    // GET /admin/package-assignments/{assignmentId}/installments
    @GetMapping
    public ResponseEntity<List<PackageInstallmentDTO>> getInstallments(@PathVariable UUID assignmentId) {
        return ResponseEntity.ok(service.getInstallments(assignmentId));
    }

    // GET /admin/package-assignments/{assignmentId}/installments/summary
    @GetMapping("/summary")
    public ResponseEntity<PackageInstallmentSummaryDTO> getSummary(@PathVariable UUID assignmentId) {
        return ResponseEntity.ok(service.getSummary(assignmentId));
    }

    // POST /admin/package-assignments/{assignmentId}/installments
    @PostMapping
    public ResponseEntity<PackageInstallmentDTO> create(
            @PathVariable UUID assignmentId,
            @Valid @RequestBody PackageInstallmentRequestDTO req) {
        log.info("ADMIN | create installment for assignmentId={}", assignmentId);
        PackageInstallmentDTO created = service.create(assignmentId, req);
        return ResponseEntity
                .created(URI.create("/admin/package-assignments/" + assignmentId + "/installments/" + created.id()))
                .body(created);
    }

    // PUT /admin/package-assignments/{assignmentId}/installments/{installmentId}
    @PutMapping("/{installmentId}")
    public ResponseEntity<PackageInstallmentDTO> update(
            @PathVariable UUID assignmentId,
            @PathVariable UUID installmentId,
            @Valid @RequestBody PackageInstallmentRequestDTO req) {
        log.info("ADMIN | update installment id={} (assignmentId={})", installmentId, assignmentId);
        return ResponseEntity.ok(service.update(assignmentId, installmentId, req));
    }

    // PATCH /admin/package-assignments/{assignmentId}/installments/{installmentId}/settle
    @PatchMapping("/{installmentId}/settle")
    public ResponseEntity<PackageInstallmentDTO> settle(
            @PathVariable UUID assignmentId,
            @PathVariable UUID installmentId,
            @RequestBody(required = false) PackageInstallmentSettleDTO body) {
        log.info("ADMIN | settle installment id={} (assignmentId={})", installmentId, assignmentId);
        return ResponseEntity.ok(service.settle(assignmentId, installmentId, body));
    }

    // PATCH /admin/package-assignments/{assignmentId}/installments/{installmentId}/unsettle
    @PatchMapping("/{installmentId}/unsettle")
    public ResponseEntity<PackageInstallmentDTO> unsettle(
            @PathVariable UUID assignmentId,
            @PathVariable UUID installmentId) {
        log.info("ADMIN | unsettle installment id={} (assignmentId={})", installmentId, assignmentId);
        return ResponseEntity.ok(service.unsettle(assignmentId, installmentId));
    }

    // DELETE /admin/package-assignments/{assignmentId}/installments/{installmentId}
    @DeleteMapping("/{installmentId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID assignmentId,
            @PathVariable UUID installmentId) {
        log.info("ADMIN | delete installment id={} (assignmentId={})", installmentId, assignmentId);
        service.delete(assignmentId, installmentId);
        return ResponseEntity.noContent().build();
    }
}
