package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

/**
 * Collected revenue split by type. The partition is mutually exclusive — every
 * collected euro lands in exactly one leg — so {@code trattamenti + prodotti +
 * pacchetti + promozioni} equals the incassato total (refunds folded into
 * trattamenti). All values 2-decimal.
 */
public record ByTypeDTO(
        BigDecimal trattamenti,
        BigDecimal prodotti,
        BigDecimal pacchetti,
        BigDecimal promozioni
) {}
