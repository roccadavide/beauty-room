package daviderocca.beautyroom.security.ratelimit;

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
            // FIX-7: rate limit su endpoint booking checkout (max 10 per IP ogni 5 min)
            } else if (path.startsWith("/checkout/bookings/")) {
                bucket = config.resolveCheckoutBookingBucket(ip);
            // FIX-W4: rate limit su endpoint order checkout prodotti
            } else if (path.startsWith("/checkout/create-session")) {
                bucket = config.resolveCheckoutBookingBucket(ip);
            } else if (path.startsWith("/waitlist")) {
                bucket = config.resolveWaitlistBucket(ip);
            } else if (path.matches("/products/[^/]+/stock-alerts")) {
                bucket = config.resolveStockAlertBucket(ip);
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

    // FIX-10: X-Forwarded-For è fidato solo se la connessione diretta arriva da un IP privato
    // (cioè da un reverse proxy/load balancer nella nostra infrastruttura).
    // Se la connessione arriva direttamente da un IP pubblico si usa getRemoteAddr(),
    // impedendo a client malevoli di spoofing del header per bypassare il rate limit.
    private String getClientIP(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();

        if (isPrivateIp(remoteAddr)) {
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
        }

        return remoteAddr;
    }

    // FIX-10: verifica se un IP è privato/loopback (proxy interno fidato)
    private boolean isPrivateIp(String ip) {
        if (ip == null) return false;
        if (ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1")) return true;
        if (ip.startsWith("10.")) return true;
        if (ip.startsWith("192.168.")) return true;
        if (ip.startsWith("172.")) {
            try {
                int second = Integer.parseInt(ip.split("\\.")[1]);
                return second >= 16 && second <= 31;
            } catch (NumberFormatException | ArrayIndexOutOfBoundsException ignored) {
                return false;
            }
        }
        return false;
    }
}

