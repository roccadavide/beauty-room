package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.packageDTOs.ActivePackageDTO;
import daviderocca.beautyroom.DTO.packageDTOs.AssignPackageCreditDTO;
import daviderocca.beautyroom.services.PackageCreditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Class stays owner-only (fail closed); the daily package flows of matrix row 18
// (assignment create + lists) are opened to STAFF method-by-method. /kpis and
// /{id}/use are not enumerated in the matrix — they stay owner-only (flagged).
@RestController
@RequestMapping("/admin/packages")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminPackageController {

    private final PackageCreditService packageCreditService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<List<ActivePackageDTO>> getAllActive() {
        return ResponseEntity.ok(packageCreditService.findAllActiveForAdmin());
    }

    @GetMapping("/kpis")
    public ResponseEntity<Map<String, Long>> getKpis() {
        return ResponseEntity.ok(packageCreditService.getPackageKpis());
    }

    /** Assegna manualmente un pacchetto a un cliente. */
    @PostMapping("/assign")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<ActivePackageDTO> assignPackage(
            @Valid @RequestBody AssignPackageCreditDTO dto) {
        return ResponseEntity.ok(packageCreditService.adminAssignPackage(dto));
    }

    /** Scala una seduta manualmente (senza prenotazione). */
    @PatchMapping("/{id}/use")
    public ResponseEntity<ActivePackageDTO> useSession(@PathVariable UUID id) {
        return ResponseEntity.ok(packageCreditService.adminUseSession(id));
    }

    /** Visualizza tutti i pacchetti di un cliente per email. */
    @GetMapping("/by-email")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<List<ActivePackageDTO>> getByEmail(
            @RequestParam String email) {
        return ResponseEntity.ok(packageCreditService.adminFindByEmail(email));
    }
}
