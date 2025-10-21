package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.userDTOs.*;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Slf4j
public class UserController {

    private final UserService userService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<UserResponseDTO>> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sort
    ) {
        log.info("Richiesta elenco utenti [page={}, size={}, sort={}]", page, size, sort);
        return ResponseEntity.ok(userService.findAllUsers(page, size, sort));
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN') or #userId.toString() == principal.userId.toString()")
    public ResponseEntity<UserResponseDTO> getUserById(@PathVariable UUID userId) {
        log.info("Richiesta dettaglio utente {}", userId);
        return ResponseEntity.ok(userService.findUserByIdAndConvert(userId));
    }

    @GetMapping("/email/{email}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponseDTO> getUserByEmail(@PathVariable String email) {
        log.info("Richiesta utente per email {}", email);
        return ResponseEntity.ok(userService.findUserByEmailAndConvert(email));
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponseDTO> getCurrentUser(@AuthenticationPrincipal User currentUser) {
        log.info("Richiesta profilo per utente autenticato {}", currentUser.getEmail());
        return ResponseEntity.ok(userService.findUserByIdAndConvert(currentUser.getUserId()));
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN') or #userId.toString() == principal.userId.toString()")
    public ResponseEntity<UserResponseDTO> updateUser(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserDTO payload
    ) {
        log.info("Aggiornamento profilo utente {}", userId);
        UserResponseDTO updated = userService.updateUserProfile(userId, payload);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- PATCH ----------------------------------

    @PatchMapping("/{userId}/password")
    @PreAuthorize("hasRole('ADMIN') or #userId.toString() == principal.userId.toString()")
    public ResponseEntity<UserResponseDTO> patchPassword(
            @PathVariable UUID userId,
            @Valid @RequestBody NewPasswordDTO payload
    ) {
        log.info("Aggiornamento password per utente {}", userId);
        UserResponseDTO updated = userService.updateUserPassword(userId, payload);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{userId}/make-admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponseDTO> promoteToAdmin(@PathVariable UUID userId) {
        log.info("Promozione utente {} a ADMIN", userId);
        return ResponseEntity.ok(userService.promoteToAdmin(userId));
    }

    @PatchMapping("/{userId}/remove-admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponseDTO> removeAdminRole(@PathVariable UUID userId) {
        log.info("Rimozione ruolo ADMIN per utente {}", userId);
        return ResponseEntity.ok(userService.revokeAdmin(userId));
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN') or #userId.toString() == principal.userId.toString()")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID userId) {
        log.info("Eliminazione utente {}", userId);
        userService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }
}