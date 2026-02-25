package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.userDTOs.*;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.InternalServerErrorException;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.services.AuthService;
import daviderocca.CAPSTONE_BACKEND.services.RefreshTokenService;
import daviderocca.CAPSTONE_BACKEND.services.UserService;
import daviderocca.CAPSTONE_BACKEND.tools.JWTTools;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final RefreshTokenService refreshTokenService;
    private final JWTTools jwtTools;

    @Value("${app.jwt.refresh-cookie.name:refresh_token}")
    private String cookieName;

    @Value("${app.jwt.refresh-expiration-ms:1209600000}")
    private long refreshExpirationMs;

    @Value("${app.jwt.refresh-cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${app.jwt.refresh-cookie.same-site:Lax}")
    private String cookieSameSite;

    @Value("${app.jwt.refresh-cookie.domain:}")
    private String cookieDomain;

    // ---------------------------------- LOGIN ----------------------------------
    @PostMapping("/login")
    public ResponseEntity<LoginUserRespDTO> login(
            @Valid @RequestBody UserLoginDTO credentials,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        log.info("Tentativo di login per utente: {}", credentials.email());
        try {
            User user = authService.checkAccessAndGetUser(credentials);
            String accessToken = jwtTools.createTokenUser(user);

            RefreshTokenService.RawAndEntity refresh = refreshTokenService.create(
                    user, request.getHeader("User-Agent"), request.getRemoteAddr()
            );
            addRefreshCookie(response, refresh.rawToken());

            log.info("Login riuscito per {}", credentials.email());
            return ResponseEntity.ok(new LoginUserRespDTO(accessToken));

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

    // ---------------------------------- REFRESH ----------------------------------
    @PostMapping("/refresh")
    public ResponseEntity<LoginUserRespDTO> refresh(HttpServletRequest request, HttpServletResponse response) {
        String rawToken = extractRefreshCookie(request);
        if (rawToken == null) {
            throw new UnauthorizedException("Refresh token mancante.");
        }

        RefreshTokenService.RawAndEntity rotated = refreshTokenService.rotate(
                rawToken, request.getHeader("User-Agent"), request.getRemoteAddr()
        );

        User user = rotated.entity().getUser();
        String accessToken = jwtTools.createTokenUser(user);
        addRefreshCookie(response, rotated.rawToken());

        log.info("Token refreshed for user={}", user.getEmail());
        return ResponseEntity.ok(new LoginUserRespDTO(accessToken));
    }

    // ---------------------------------- LOGOUT ----------------------------------
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request, HttpServletResponse response) {
        String rawToken = extractRefreshCookie(request);
        if (rawToken != null) {
            refreshTokenService.revoke(rawToken);
        }
        clearRefreshCookie(response);
        log.info("Logout eseguito");
        return ResponseEntity.ok(Map.of("message", "Logout effettuato."));
    }

    // ---------------------------------- REGISTER ----------------------------------
    @PostMapping("/register")
    public ResponseEntity<UserResponseDTO> register(@Valid @RequestBody NewUserDTO payload) {
        log.info("Richiesta registrazione nuovo utente con email {}", payload.email());
        UserResponseDTO created = userService.saveUser(payload);
        log.info("Registrazione completata per {}", payload.email());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // ---------------------------------- COOKIE HELPERS ----------------------------------

    private void addRefreshCookie(HttpServletResponse response, String rawToken) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(cookieName, rawToken)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/auth")
                .maxAge(refreshExpirationMs / 1000)
                .sameSite(cookieSameSite);

        if (cookieDomain != null && !cookieDomain.isBlank()) {
            builder.domain(cookieDomain);
        }
        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(cookieName, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/auth")
                .maxAge(0)
                .sameSite(cookieSameSite);

        if (cookieDomain != null && !cookieDomain.isBlank()) {
            builder.domain(cookieDomain);
        }
        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());
    }

    private String extractRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        return Arrays.stream(cookies)
                .filter(c -> cookieName.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> v != null && !v.isBlank())
                .findFirst()
                .orElse(null);
    }
}