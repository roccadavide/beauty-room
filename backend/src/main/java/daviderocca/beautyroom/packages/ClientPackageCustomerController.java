package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/client/my-package-assignments")
@RequiredArgsConstructor
@Slf4j
public class ClientPackageCustomerController {

    private final ClientPackageService service;

    // GET /api/client/my-package-assignments — returns all assignments linked to the authenticated user
    @GetMapping
    public ResponseEntity<List<ClientPackageAssignmentDTO>> myAssignments(
            @AuthenticationPrincipal User currentUser) {
        log.info("CLIENT | package assignments for userId={}", currentUser.getUserId());
        return ResponseEntity.ok(service.findByUserId(currentUser.getUserId()));
    }

    // GET /api/client/my-package-assignments/active — only ACTIVE
    @GetMapping("/active")
    public ResponseEntity<List<ClientPackageAssignmentDTO>> myActiveAssignments(
            @AuthenticationPrincipal User currentUser) {
        log.info("CLIENT | active package assignments for userId={}", currentUser.getUserId());
        return ResponseEntity.ok(service.findActiveByUserId(currentUser.getUserId()));
    }
}
