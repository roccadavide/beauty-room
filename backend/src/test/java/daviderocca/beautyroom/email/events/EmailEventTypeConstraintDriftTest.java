package daviderocca.beautyroom.email.events;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Drift guard (pure unit test, no DB): asserts that every {@link EmailEventType}
 * value is whitelisted in the Postgres CHECK constraint
 * {@code email_outbox_event_type_check}.
 *
 * <p>Why this exists: the email merge added 4 enum values without adding them to
 * the constraint, so enqueuing any of them violated the CHECK at commit and rolled
 * back the entire move/cancel/refund transaction. Neither {@code ddl-auto=validate}
 * (it does not check CHECK constraints) nor the Mockito tests can catch this class
 * of drift — only matching the enum against the actual migration SQL can.
 *
 * <p>The test reads the <em>latest</em> migration that (re)defines the constraint
 * straight from the classpath, so it keeps tracking the effective definition even
 * after a future migration supersedes it. Adding a new {@code EmailEventType}
 * value without whitelisting it in a migration breaks the build.
 */
class EmailEventTypeConstraintDriftTest {

    private static final String MIGRATIONS = "classpath*:db/migration/V*.sql";
    private static final String CONSTRAINT = "email_outbox_event_type_check";

    /** Captures the body of the single {@code event_type IN ( ... )} list. */
    private static final Pattern EVENT_TYPE_IN_LIST =
            Pattern.compile("event_type\\s+IN\\s*\\((.*?)\\)",
                    Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern VERSION = Pattern.compile("V(\\d+)__");
    private static final Pattern QUOTED_TOKEN = Pattern.compile("'([^']+)'");

    @Test
    @DisplayName("every EmailEventType value is whitelisted in email_outbox_event_type_check")
    void everyEnumValueIsWhitelisted() throws IOException {
        Resource migration = latestMigrationDefiningConstraint();
        assertNotNull(migration,
                "no migration on the classpath defines " + CONSTRAINT + " with an event_type IN (...) list");

        Set<String> whitelisted = parseEventTypeWhitelist(stripLineComments(read(migration)));

        Set<String> missing = new LinkedHashSet<>();
        for (EmailEventType type : EmailEventType.values()) {
            if (!whitelisted.contains(type.name())) {
                missing.add(type.name());
            }
        }

        assertTrue(missing.isEmpty(),
                () -> "EmailEventType values missing from " + CONSTRAINT + " in "
                        + migration.getFilename() + ": " + missing
                        + " — add a migration whitelisting them.");
    }

    /** The highest-versioned migration whose body (re)defines the constraint. */
    private Resource latestMigrationDefiningConstraint() throws IOException {
        Resource latest = null;
        int latestVersion = -1;
        for (Resource r : new PathMatchingResourcePatternResolver().getResources(MIGRATIONS)) {
            String name = r.getFilename();
            if (name == null) {
                continue;
            }
            Matcher vm = VERSION.matcher(name);
            if (!vm.find()) {
                continue;
            }
            int version = Integer.parseInt(vm.group(1));
            if (version <= latestVersion) {
                continue;
            }
            String sql = stripLineComments(read(r));
            if (sql.contains(CONSTRAINT) && EVENT_TYPE_IN_LIST.matcher(sql).find()) {
                latestVersion = version;
                latest = r;
            }
        }
        return latest;
    }

    private Set<String> parseEventTypeWhitelist(String sql) {
        Matcher list = EVENT_TYPE_IN_LIST.matcher(sql);
        assertTrue(list.find(), "could not locate `event_type IN (...)` in the constraint migration");
        Set<String> tokens = new LinkedHashSet<>();
        Matcher token = QUOTED_TOKEN.matcher(list.group(1));
        while (token.find()) {
            tokens.add(token.group(1));
        }
        return tokens;
    }

    /** Drops {@code -- ...} line comments so comment punctuation cannot confuse the parser. */
    private static String stripLineComments(String sql) {
        return sql.replaceAll("--[^\\n]*", "");
    }

    private static String read(Resource r) throws IOException {
        try (InputStream in = r.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
