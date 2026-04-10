package daviderocca.beautyroom.DTO.orderDTOs;

import daviderocca.beautyroom.enums.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateOrderStatusDTO(
        @NotNull(message = "Il nuovo stato è obbligatorio")
        OrderStatus status
) {}
