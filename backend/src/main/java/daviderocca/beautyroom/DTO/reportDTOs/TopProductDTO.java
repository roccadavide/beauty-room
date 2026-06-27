package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

/**
 * A top product by collected revenue, across BOTH in-store ({@code booking_sales})
 * and online ({@code order_items}) sales. {@code count} = total units sold.
 */
public record TopProductDTO(
        String name,
        long count,
        BigDecimal revenue
) {}
