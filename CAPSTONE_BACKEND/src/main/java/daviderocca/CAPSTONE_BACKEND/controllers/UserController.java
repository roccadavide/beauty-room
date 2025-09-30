package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.NewPasswordDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewUserDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.UpdateUserDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.UserResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.BindingResult;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import org.springframework.http.HttpStatus;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/users")
@Slf4j
public class UserController {

    @Autowired
    private UserService userService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('ADMIN')")
    public Page<UserResponseDTO> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sort
    ) {
        log.info("Richiesta elenco utenti - pagina: {}, size: {}, sort: {}", page, size, sort);
        return userService.findAllUsers(page, size, sort);
    }

    @GetMapping("/{userId}")
    @ResponseStatus(HttpStatus.OK)
    public UserResponseDTO getUserById(@PathVariable UUID userId) {
        log.info("Richiesta dettaglio utente {}", userId);
        return userService.findUserByIdAndConvert(userId);
    }

    @GetMapping("/email/{email}")
    @ResponseStatus(HttpStatus.OK)
    public UserResponseDTO getUserByEmail(@PathVariable String email) {
        log.info("Richiesta utente per email {}", email);
        return userService.findUserByEmailAndConvert(email);
    }

    @GetMapping("/me")
    @ResponseStatus(HttpStatus.OK)
    public UserResponseDTO getCurrentUser(@AuthenticationPrincipal User currentUser) {
        log.info("Richiesta profilo utente autenticato: {}", currentUser.getUserId());
        return userService.findUserByIdAndConvert(currentUser.getUserId());
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponseDTO createUser(@Validated @RequestBody NewUserDTO payload, BindingResult bindingResult) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta creazione utente {}", payload.email());
        return userService.saveUser(payload);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{userId}")
    @ResponseStatus(HttpStatus.OK)
    public UserResponseDTO updateUser(
            @PathVariable UUID userId,
            @Validated @RequestBody UpdateUserDTO payload,
            BindingResult bindingResult
    ) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta aggiornamento utente {}", userId);
        return userService.findUserByIdAndUpdateProfile(userId, payload);
    }

    // ---------------------------------- PATCH ----------------------------------

    @PatchMapping("/{userId}/password")
    @ResponseStatus(HttpStatus.OK)
    public UserResponseDTO patchPassword(
            @PathVariable UUID userId,
            @Validated @RequestBody NewPasswordDTO payload,
            BindingResult bindingResult
    ) {
        if (bindingResult.hasErrors()) {
            throw new BadRequestException(
                    bindingResult.getAllErrors()
                            .stream()
                            .map(e -> e.getDefaultMessage())
                            .collect(Collectors.joining(", "))
            );
        }

        log.info("Richiesta aggiornamento password utente {}", userId);
        return userService.findUserByIdAndPatchPassword(userId, payload);
    }

    @PatchMapping("/{userId}/make-admin")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponseDTO promoteToAdmin(@PathVariable UUID userId) {
        log.info("Richiesta promozione utente {} a ADMIN", userId);
        return userService.findUserByIdAndPatchToAdmin(userId);
    }

    @PatchMapping("/{userId}/remove-admin")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponseDTO removeAdminRole(@PathVariable UUID userId) {
        log.info("Richiesta rimozione ruolo ADMIN per utente {}", userId);
        return userService.findUserByIdAndRemoveFromAdmin(userId);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable UUID userId) {
        log.info("Richiesta eliminazione utente {}", userId);
        userService.findUserByIdAndDelete(userId);
    }
}