package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.userDTOs.*;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.InternalServerErrorException;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.services.AuthService;
import daviderocca.CAPSTONE_BACKEND.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;

    private final UserService userService;

    // ---------------------------------- LOGIN ----------------------------------
    @PostMapping("/login")
    public ResponseEntity<LoginUserRespDTO> login(@Valid @RequestBody UserLoginDTO credentials) {
        log.info("Tentativo di login per utente: {}", credentials.email());
        try {
            String token = authService.checkAccessAndGenerateToken(credentials);
            log.info("Login riuscito per {}", credentials.email());
            return ResponseEntity.ok(new LoginUserRespDTO(token));

        } catch (BadRequestException e) {
            log.warn("Credenziali non valide per {}: {}", credentials.email(), e.getMessage());
            throw e;

        } catch (UnauthorizedException e) {
            log.warn("Accesso negato per {}: {}", credentials.email(), e.getMessage());
            throw new BadRequestException("Email o password non corretta.");

        } catch (Exception e) {
            log.error("Errore inatteso durante il login di {}: {}", credentials.email(), e.getMessage());
            throw new InternalServerErrorException("Si è verificato un errore interno. Riprova più tardi.");
        }
    }

    // ---------------------------------- REGISTER ----------------------------------
    @PostMapping("/register")
    public ResponseEntity<UserResponseDTO> register(@Valid @RequestBody NewUserDTO payload) {
        log.info("Richiesta registrazione nuovo utente con email {}", payload.email());
        UserResponseDTO created = userService.saveUser(payload);
        log.info("Registrazione completata per {}", payload.email());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}