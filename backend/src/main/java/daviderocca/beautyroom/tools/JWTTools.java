package daviderocca.beautyroom.tools;

import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.exceptions.UnauthorizedException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Component
public class JWTTools {

    @Value("${JWT.SECRET}")
    private String secret;

    @Value("${app.jwt.access-expiration-ms:900000}")
    private long accessExpirationMs;

    public String createTokenUser(User user) {
        return Jwts.builder()
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + accessExpirationMs))
                .subject(user.getEmail())
                .claim("id", user.getUserId().toString())
                .claim("jti", UUID.randomUUID().toString())
                .claim("isVerified", user.isVerified())
                .signWith(Keys.hmacShaKeyFor(secret.getBytes()))
                .compact();
    }

    public void verifyToken(String accessToken) {
        try {
            Jwts.parser()
                    .verifyWith(Keys.hmacShaKeyFor(secret.getBytes()))
                    .build()
                    .parseSignedClaims(accessToken)
                    .getPayload()
                    .getSubject();
        } catch (Exception ex) {
            throw new UnauthorizedException("La sessione è scaduta! Effettuare di nuovo il login!");
        }
    }

    public String extractSubject(String accessToken) {
        return Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(secret.getBytes()))
                .build()
                .parseSignedClaims(accessToken)
                .getPayload()
                .getSubject();
    }

    public String extractJti(String accessToken) {
        return Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(secret.getBytes()))
                .build()
                .parseSignedClaims(accessToken)
                .getPayload()
                .get("jti", String.class);
    }

    public Instant extractExpiration(String accessToken) {
        Date expiration = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(secret.getBytes()))
                .build()
                .parseSignedClaims(accessToken)
                .getPayload()
                .getExpiration();
        return expiration.toInstant();
    }
}
