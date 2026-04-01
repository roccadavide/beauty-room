package daviderocca.beautyroom.DTO.orderDTOs;

import daviderocca.beautyroom.DTO.orderItemDTOs.OrderItemResponseDTO;
import daviderocca.beautyroom.enums.OrderStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record OrderResponseDTO(
        UUID orderId,
        String customerName,
        String customerSurname,
        String customerEmail,
        String customerPhone,
        String pickupNote,
        OrderStatus orderStatus,
        LocalDateTime createdAt,
        UUID userId,
        List<OrderItemResponseDTO> orderItems
) {}