package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.userDTOs.*;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.InternalServerErrorException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.exceptions.UnauthorizedException;
import daviderocca.beautyroom.security.TokenBlocklist;
import daviderocca.beautyroom.services.AuthService;
import daviderocca.beautyroom.services.RefreshTokenService;
import daviderocca.beautyroom.services.UserService;
import daviderocca.beautyroom.tools.JWTTools;
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
    private final TokenBlocklist tokenBlocklist;

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

            // null/absent => true: preserves the always-persistent login for any caller (e.g. an
            // old client) that doesn't send the flag.
            boolean rememberMe = credentials.rememberMe() == null ? true : credentials.rememberMe();
            RefreshTokenService.RawAndEntity refresh = refreshTokenService.create(
                    user, request.getHeader("User-Agent"), request.getRemoteAddr(), rememberMe
            );
            addRefreshCookie(response, refresh.rawToken(), rememberMe);

            log.info("Login riuscito per {}", credentials.email());
            return ResponseEntity.ok(new LoginUserRespDTO(accessToken));

        } catch (ResourceNotFoundException e) {
            log.warn("Tentativo di login con email inesistente {}: {}", credentials.email(), e.getMessage());
            throw new BadRequestException("Email o password non corretta.");
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

        RefreshTokenService.RotateResult rotated = refreshTokenService.rotate(
                rawToken, request.getHeader("User-Agent"), request.getRemoteAddr()
        );

        User user = rotated.user();
        String accessToken = jwtTools.createTokenUser(user);

        // On grace-hit, the client already holds the child refresh cookie from the prior
        // rotation — re-setting it would be redundant and rawToken is null anyway.
        if (!rotated.graceHit()) {
            addRefreshCookie(response, rotated.rawToken(), rotated.rememberMe());
        }

        log.info("Token refreshed for user={} graceHit={}", user.getEmail(), rotated.graceHit());
        return ResponseEntity.ok(new LoginUserRespDTO(accessToken));
    }

    // ---------------------------------- LOGOUT ----------------------------------
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request, HttpServletResponse response) {
        String rawToken = extractRefreshCookie(request);
        if (rawToken != null) {
            refreshTokenService.revoke(rawToken);
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String accessToken = authHeader.substring(7);
            try {
                String jti = jwtTools.extractJti(accessToken);
                tokenBlocklist.block(jti, jwtTools.extractExpiration(accessToken));
            } catch (Exception ex) {
                log.warn("Impossibile aggiungere access token in blocklist durante logout: {}", ex.getMessage());
            }
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

    private void addRefreshCookie(HttpServletResponse response, String rawToken, boolean rememberMe) {
        // remembered => full 14-day Max-Age (persistent cookie); not remembered => negative Max-Age,
        // which emits NO Max-Age attribute = a session cookie that dies when the browser closes.
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(cookieName, rawToken)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/auth")
                .maxAge(rememberMe ? refreshExpirationMs / 1000 : -1)
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