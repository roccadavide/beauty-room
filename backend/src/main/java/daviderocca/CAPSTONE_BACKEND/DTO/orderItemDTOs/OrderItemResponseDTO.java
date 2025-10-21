package daviderocca.CAPSTONE_BACKEND.DTO.orderItemDTOs;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemResponseDTO(
        UUID orderItemId,
        Integer quantity,
        BigDecimal price,
        UUID productId,
        UUID orderId
) {}