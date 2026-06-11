package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.bookingDTOs.SaleEntryDTO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fix 3: unit tests for the "products" metadata decode (the round-trip partner of the encode in
 * {@link BookingCheckoutController#createSessionMulti}). Lives in the controller package so it can
 * reach the package-private static {@code parseProductsMetadata}.
 */
class StripeWebhookControllerTest {

    @Test
    @DisplayName("Fix 3: parseProductsMetadata decodes id:qty:cents into paid sale carriers")
    void parseProductsMetadata_decodesEntries() {
        UUID p1 = UUID.randomUUID();
        UUID p2 = UUID.randomUUID();
        String raw = p1 + ":2:1990," + p2 + ":1:3000";

        List<SaleEntryDTO> out = StripeWebhookController.parseProductsMetadata(raw);

        assertThat(out).hasSize(2);
        assertThat(out.get(0).productId()).isEqualTo(p1);
        assertThat(out.get(0).quantity()).isEqualTo(2);
        assertThat(out.get(0).unitPrice()).isEqualByComparingTo(new BigDecimal("19.90")); // 1990 cents
        assertThat(out.get(0).paid()).isTrue();
        assertThat(out.get(1).productId()).isEqualTo(p2);
        assertThat(out.get(1).quantity()).isEqualTo(1);
        assertThat(out.get(1).unitPrice()).isEqualByComparingTo(new BigDecimal("30.00")); // 3000 cents
        assertThat(out.get(1).paid()).isTrue();
    }

    @Test
    @DisplayName("Fix 3: parseProductsMetadata returns empty for null / blank input")
    void parseProductsMetadata_emptyForBlank() {
        assertThat(StripeWebhookController.parseProductsMetadata(null)).isEmpty();
        assertThat(StripeWebhookController.parseProductsMetadata("")).isEmpty();
        assertThat(StripeWebhookController.parseProductsMetadata("   ")).isEmpty();
    }

    @Test
    @DisplayName("Fix 3: parseProductsMetadata skips malformed entries and keeps the valid ones (payment already done)")
    void parseProductsMetadata_skipsMalformed() {
        UUID ok = UUID.randomUUID();
        // bad uuid, wrong arity, non-numeric cents, then one valid entry — only the valid one survives.
        String raw = "not-a-uuid:1:100,foo:bar," + UUID.randomUUID() + ":2:abc," + ok + ":1:500";

        List<SaleEntryDTO> out = StripeWebhookController.parseProductsMetadata(raw);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).productId()).isEqualTo(ok);
        assertThat(out.get(0).quantity()).isEqualTo(1);
        assertThat(out.get(0).unitPrice()).isEqualByComparingTo(new BigDecimal("5.00")); // 500 cents
    }
}
