package daviderocca.CAPSTONE_BACKEND.security.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class RateLimitConfig {

    private static final long LOGIN_CAPACITY = 5;
    private static final long REGISTER_CAPACITY = 3;
    // FIX-7: 10 tentativi di prenotazione per IP ogni 5 minuti
    private static final long CHECKOUT_BOOKING_CAPACITY = 10;

    private final Cache<String, Bucket> loginBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofHours(1))
            .build();

    private final Cache<String, Bucket> registerBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofHours(1))
            .build();

    // FIX-7: cache bucket per endpoint booking checkout
    private final Cache<String, Bucket> checkoutBookingBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofHours(1))
            .build();

    private Bandwidth loginBandwidth() {
        return Bandwidth.classic(LOGIN_CAPACITY, Refill.greedy(LOGIN_CAPACITY, Duration.ofMinutes(1)));
    }

    private Bandwidth registerBandwidth() {
        return Bandwidth.classic(REGISTER_CAPACITY, Refill.greedy(REGISTER_CAPACITY, Duration.ofMinutes(1)));
    }

    // FIX-7: 10 richieste per IP ogni 5 minuti sul checkout booking
    private Bandwidth checkoutBookingBandwidth() {
        return Bandwidth.classic(CHECKOUT_BOOKING_CAPACITY, Refill.greedy(CHECKOUT_BOOKING_CAPACITY, Duration.ofMinutes(5)));
    }

    public Bucket resolveLoginBucket(String ip) {
        return loginBuckets.get(ip, k -> Bucket.builder().addLimit(loginBandwidth()).build());
    }

    public Bucket resolveRegisterBucket(String ip) {
        return registerBuckets.get(ip, k -> Bucket.builder().addLimit(registerBandwidth()).build());
    }

    // FIX-7: resolve bucket per /checkout/bookings/
    public Bucket resolveCheckoutBookingBucket(String ip) {
        return checkoutBookingBuckets.get(ip, k -> Bucket.builder().addLimit(checkoutBookingBandwidth()).build());
    }

    public long getLoginCapacity() {
        return LOGIN_CAPACITY;
    }

    public long getRegisterCapacity() {
        return REGISTER_CAPACITY;
    }
}

