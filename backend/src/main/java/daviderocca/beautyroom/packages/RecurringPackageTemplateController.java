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

/**
 * Admin CRUD for recurring package templates. Admin-only: these are internal
 * recipes and are never exposed on the public Occasioni catalog.
 */
@RestController
@RequestMapping("/admin/recurring-package-templates")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class RecurringPackageTemplateController {

    private final RecurringPackageTemplateService service;

    // POST /admin/recurring-package-templates — create
    @PostMapping
    public ResponseEntity<RecurringPackageTemplateDTO> create(
            @Valid @RequestBody RecurringPackageTemplateRequestDTO req) {
        RecurringPackageTemplateDTO created = service.create(req);
        return ResponseEntity
                .created(URI.create("/admin/recurring-package-templates/" + created.id()))
                .body(created);
    }

    // GET /admin/recurring-package-templates — list active (non-archived)
    @GetMapping
    public ResponseEntity<List<RecurringPackageTemplateDTO>> findAll() {
        return ResponseEntity.ok(service.findAllActive());
    }

    // GET /admin/recurring-package-templates/{id} — get one
    @GetMapping("/{id}")
    public ResponseEntity<RecurringPackageTemplateDTO> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    // PUT /admin/recurring-package-templates/{id} — update
    @PutMapping("/{id}")
    public ResponseEntity<RecurringPackageTemplateDTO> update(
            @PathVariable UUID id,
            @Valid @RequestBody RecurringPackageTemplateRequestDTO req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    // DELETE /admin/recurring-package-templates/{id} — soft archive
    @DeleteMapping("/{id}")
    public ResponseEntity<RecurringPackageTemplateDTO> archive(@PathVariable UUID id) {
        return ResponseEntity.ok(service.archive(id));
    }
}
