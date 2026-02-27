package daviderocca.CAPSTONE_BACKEND.security.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitConfig config;
    private final ObjectMapper om;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getServletPath();
        String method = request.getMethod();

        // only protect POST /auth/login and POST /auth/register
        if (!"POST".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = getClientIP(request);

        try {
            Bucket bucket = null;

            if (path.startsWith("/auth/login")) {
                bucket = config.resolveLoginBucket(ip);
            } else if (path.startsWith("/auth/register")) {
                bucket = config.resolveRegisterBucket(ip);
            }

            if (bucket == null) {
                filterChain.doFilter(request, response);
                return;
            }

            ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

            if (probe.isConsumed()) {
                response.setHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
                filterChain.doFilter(request, response);
            } else {
                long retryAfterSeconds = Duration.ofNanos(probe.getNanosToWaitForRefill()).getSeconds();
                if (retryAfterSeconds <= 0) {
                    retryAfterSeconds = 1;
                }

                log.warn("Rate limit exceeded for IP={} path={}", ip, path);
                response.setStatus(429);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setHeader("X-RateLimit-Remaining", "0");
                response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
                om.writeValue(response.getWriter(), Map.of("error", "Too many requests"));
            }
        } catch (Exception ex) {
            // Non bloccare la richiesta se qualcosa va storto con il bucket/cache
            log.error("Rate limiting error for IP={} path={}", ip, path, ex);
            filterChain.doFilter(request, response);
        }
    }

    private String getClientIP(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            String[] parts = xForwardedFor.split(",");
            for (String part : parts) {
                String candidate = part.trim();
                if (!candidate.isEmpty() && !"unknown".equalsIgnoreCase(candidate)) {
                    return candidate;
                }
            }
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank() && !"unknown".equalsIgnoreCase(realIp)) {
            return realIp;
        }

        return request.getRemoteAddr();
    }
}

