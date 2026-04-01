package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.packageDTOs.MyPackageDTO;
import daviderocca.beautyroom.services.PackageCreditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/client/packages")
@RequiredArgsConstructor
public class ClientPackageController {

    private final PackageCreditService packageCreditService;

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<MyPackageDTO>> getMyPackages(Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(packageCreditService.getMyPackages(email));
    }
}
