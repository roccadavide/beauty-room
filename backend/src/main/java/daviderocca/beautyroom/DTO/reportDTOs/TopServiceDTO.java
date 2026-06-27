package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

/** A top service by collected revenue. {@code count} = number of paid service lines. */
public record TopServiceDTO(
        String name,
        long count,
        BigDecimal revenue
) {}
