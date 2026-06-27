package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

/** Collected revenue split by channel (Stripe online vs in-store cash/SumUp). */
public record ByChannelDTO(
        BigDecimal online,
        BigDecimal inStore
) {}
