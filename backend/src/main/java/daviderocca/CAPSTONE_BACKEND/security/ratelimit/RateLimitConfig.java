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

    private final Cache<String, Bucket> loginBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofHours(1))
            .build();

    private final Cache<String, Bucket> registerBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofHours(1))
            .build();

    private Bandwidth loginBandwidth() {
        return Bandwidth.classic(LOGIN_CAPACITY, Refill.greedy(LOGIN_CAPACITY, Duration.ofMinutes(1)));
    }

    private Bandwidth registerBandwidth() {
        return Bandwidth.classic(REGISTER_CAPACITY, Refill.greedy(REGISTER_CAPACITY, Duration.ofMinutes(1)));
    }

    public Bucket resolveLoginBucket(String ip) {
        return loginBuckets.get(ip, k -> Bucket.builder().addLimit(loginBandwidth()).build());
    }

    public Bucket resolveRegisterBucket(String ip) {
        return registerBuckets.get(ip, k -> Bucket.builder().addLimit(registerBandwidth()).build());
    }

    public long getLoginCapacity() {
        return LOGIN_CAPACITY;
    }

    public long getRegisterCapacity() {
        return REGISTER_CAPACITY;
    }
}

