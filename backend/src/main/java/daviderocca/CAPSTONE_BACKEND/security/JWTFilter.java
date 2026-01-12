package daviderocca.CAPSTONE_BACKEND.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import daviderocca.CAPSTONE_BACKEND.DTO.ApiError;
import daviderocca.CAPSTONE_BACKEND.tools.JWTTools;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class JWTFilter extends OncePerRequestFilter {

    private final JWTTools jwtTools;
    private final UserDetailsService userDetailsService;
    private final ObjectMapper om;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            chain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        try {
            jwtTools.verifyToken(token);
            String email = jwtTools.extractSubject(token);

            UserDetails user = userDetailsService.loadUserByUsername(email);
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());

            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception ex) {
            log.warn("JWT non valido: {}", ex.getMessage());
            ApiError body = new ApiError(
                    Instant.now(),
                    401,
                    "Unauthorized",
                    "Invalid or expired token",
                    request.getRequestURI(),
                    Map.of("cause", ex.getClass().getSimpleName())
            );
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            om.writeValue(response.getWriter(), body);
            return;
        }

        chain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();

        if (path.startsWith("/auth") || path.startsWith("/stripe") || path.startsWith("/checkout")) return true;

        if (request.getMethod().equals("GET") && (
                path.startsWith("/products") ||
                        path.startsWith("/service-items") ||
                        path.startsWith("/results") ||
                        path.startsWith("/availabilities/services") ||
                        path.startsWith("/categories") ||
                        path.startsWith("/promotions")
        )) return true;

        return false;
    }
}