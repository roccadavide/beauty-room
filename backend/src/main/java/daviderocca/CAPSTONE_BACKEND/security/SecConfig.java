package daviderocca.CAPSTONE_BACKEND.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import daviderocca.CAPSTONE_BACKEND.DTO.ApiError;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.springframework.beans.factory.annotation.Value;

import java.time.Instant;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecConfig {

    @Value("${app.cors.origins}")
    private List<String> corsOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JWTFilter jwtFilter, ObjectMapper om) throws Exception {

        AuthenticationEntryPoint entryPoint = (request, response, authException) -> {
            ApiError body = new ApiError(
                    Instant.now(),
                    401,
                    "Unauthorized",
                    "Authentication required",
                    request.getRequestURI(),
                    null
            );
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            om.writeValue(response.getWriter(), body);
        };

        AccessDeniedHandler deniedHandler = (request, response, accessDeniedException) -> {
            ApiError body = new ApiError(
                    Instant.now(),
                    403,
                    "Forbidden",
                    "Accesso negato",
                    request.getRequestURI(),
                    null
            );
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            om.writeValue(response.getWriter(), body);
        };

        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler)
                )
                .authorizeHttpRequests(auth -> auth
                        // CORS preflight
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // AUTH
                        .requestMatchers("/auth/**").permitAll()

                        // STRIPE WEBHOOK
                        .requestMatchers(HttpMethod.POST, "/stripe/webhook").permitAll()

                        // CHECKOUT
                        .requestMatchers(HttpMethod.POST, "/checkout/create-session-guest").permitAll()
                        .requestMatchers(HttpMethod.POST, "/checkout/create-session").authenticated()
                                .requestMatchers(HttpMethod.POST, "/checkout/bookings/create-session-guest").permitAll()
                                .requestMatchers(HttpMethod.POST, "/checkout/bookings/create-session").authenticated()
// CHECKOUT (public + auth)
                                .requestMatchers(HttpMethod.GET, "/checkout/bookings/booking-summary").permitAll()
                                .requestMatchers(HttpMethod.GET,  "/checkout/order-summary").permitAll()

                        // PUBLIC GET
                        .requestMatchers(HttpMethod.GET,
                                "/products/**",
                                "/service-items/**",
                                "/results/**",
                                "/availabilities/services/**",
                                "/categories/**",
                                "/promotions/**"
                        ).permitAll()

                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .formLogin(f -> f.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()));

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();

        cfg.setAllowedOriginPatterns(corsOrigins);

        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));

        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Stripe-Signature"));
        cfg.setExposedHeaders(List.of("Location"));

        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}