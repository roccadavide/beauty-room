package daviderocca.beautyroom.packages;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Cross-package installment queries for the agenda. Deliberately kept OFF the
 * /admin/package-assignments/{assignmentId}/installments nesting so the date-range
 * "due" feed never collides with the {assignmentId} path variable.
 */
@RestController
@RequestMapping("/admin/package-installments")
@PreAuthorize("hasAnyRole('ADMIN','STAFF')")
@RequiredArgsConstructor
public class PackageInstallmentQueryController {

    private final PackageInstallmentService service;

    // GET /admin/package-installments/due?from=YYYY-MM-DD&to=YYYY-MM-DD
    // The agenda calls with from == to == the selected day.
    @GetMapping("/due")
    public ResponseEntity<List<InstallmentDueDTO>> due(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(service.getInstallmentsDue(from, to));
    }

    // GET /admin/package-installments/summaries?ids=uuid1,uuid2,uuid3
    // One batched row per package for the always-on "Pagato X su Y" + "Completa" gate.
    @GetMapping("/summaries")
    public ResponseEntity<List<PackageInstallmentBatchSummaryDTO>> summaries(@RequestParam List<UUID> ids) {
        return ResponseEntity.ok(service.getBatchSummaries(ids));
    }
}
