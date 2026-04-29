package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/client/my-packages")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class ClientPackageUserController {

    private final ClientPackageService service;

    @GetMapping
    public ResponseEntity<List<ClientPackageAssignmentDTO>> getMyPackages(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(service.findByUserId(currentUser.getUserId()));
    }
}
