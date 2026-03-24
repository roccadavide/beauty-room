package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.packageDTOs.ActivePackageDTO;
import daviderocca.CAPSTONE_BACKEND.services.PackageCreditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/packages")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminPackageController {

    private final PackageCreditService packageCreditService;

    @GetMapping
    public ResponseEntity<List<ActivePackageDTO>> getAllActive() {
        return ResponseEntity.ok(packageCreditService.findAllActiveForAdmin());
    }

    @GetMapping("/kpis")
    public ResponseEntity<Map<String, Long>> getKpis() {
        return ResponseEntity.ok(packageCreditService.getPackageKpis());
    }
}
