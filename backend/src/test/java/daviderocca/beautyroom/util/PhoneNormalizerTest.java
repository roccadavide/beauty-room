package daviderocca.beautyroom.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Locks {@link PhoneNormalizer#normalize(String)} to canonical E.164 output.
 *
 * <p>Expected values are exactly what {@code frontend/src/utils/reminders.js →
 * normalizeItalianPhone()} produces (digits-only) with a leading {@code +} added,
 * because the two implementations — plus the V80 SQL backfill — must agree
 * byte-for-byte or customer-dedup lookups won't match the rows V80 wrote.
 */
class PhoneNormalizerTest {

    @Test
    @DisplayName("bare IT mobile (spaced) -> +39…")
    void bareMobile() {
        assertThat(PhoneNormalizer.normalize("347 123 4567")).isEqualTo("+393471234567");
    }

    @Test
    @DisplayName("already +39 prefixed -> +39… (idempotent on the +)")
    void plus39Prefixed() {
        assertThat(PhoneNormalizer.normalize("+39 347 123 4567")).isEqualTo("+393471234567");
    }

    @Test
    @DisplayName("bare 39-prefixed digits -> +39…")
    void digits39Prefixed() {
        assertThat(PhoneNormalizer.normalize("393471234567")).isEqualTo("+393471234567");
    }

    @Test
    @DisplayName("00 international prefix is stripped before normalizing")
    void zeroZeroIntlPrefix() {
        assertThat(PhoneNormalizer.normalize("0039 347 123 4567")).isEqualTo("+393471234567");
    }

    @Test
    @DisplayName("IT landline -> +39… via the fallback branch")
    void landline() {
        // reminders.js fallback prepends 39 to anything not already 39-prefixed.
        assertThat(PhoneNormalizer.normalize("06 1234567")).isEqualTo("+39061234567");
    }

    @Test
    @DisplayName("normalize is idempotent on its own E.164 output")
    void idempotent() {
        assertThat(PhoneNormalizer.normalize("+393471234567")).isEqualTo("+393471234567");
        assertThat(PhoneNormalizer.normalize("+39061234567")).isEqualTo("+39061234567");
    }

    @Test
    @DisplayName("null / empty / no-digits -> null (stays out of the partial unique index)")
    void nullEmptyOrNoDigits() {
        assertThat(PhoneNormalizer.normalize(null)).isNull();
        assertThat(PhoneNormalizer.normalize("")).isNull();
        assertThat(PhoneNormalizer.normalize("abc")).isNull();
    }
}
