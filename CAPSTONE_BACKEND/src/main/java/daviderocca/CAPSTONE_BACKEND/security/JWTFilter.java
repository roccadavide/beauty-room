package daviderocca.CAPSTONE_BACKEND.security;

import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.services.UserService;
import daviderocca.CAPSTONE_BACKEND.tools.JWTTools;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Slf4j
public class JWTFilter extends OncePerRequestFilter {

    @Autowired
    private JWTTools jwtTools;

   @Autowired
   private UserService userService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {

        String path = request.getServletPath();

            if (
                path.equals("/users/register")
                || path.equals("/categories")
                || (request.getMethod().equals("GET") && path.startsWith("/serviceItems"))
                || (request.getMethod().equals("GET") && path.startsWith("/results"))
                || (request.getMethod().equals("GET") && path.startsWith("/availabilities"))
                || (request.getMethod().equals("GET") && path.startsWith("/products"))) {
            filterChain.doFilter(request, response);
            return;
        }

        // *********************************************** AUTENTICAZIONE ***************************************************

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String accessToken = authHeader.replace("Bearer ", "");

        jwtTools.verifyToken(accessToken);

        // ****************************************** AUTORIZZAZIONE *******************************************************
        String email = jwtTools.extractSubject(accessToken);

        User activeUser = this.userService.findUserByEmail(email);

        if (activeUser == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Utente non trovato!");
            return;
        }

        // Spring Security userà le authorities dell’utente
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                activeUser,
                null,
                activeUser.getAuthorities()
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return new AntPathMatcher().match("/noAuth/**", request.getServletPath());
    }
}
