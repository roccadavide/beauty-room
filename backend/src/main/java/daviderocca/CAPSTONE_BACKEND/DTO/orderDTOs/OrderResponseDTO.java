package daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs;

import daviderocca.CAPSTONE_BACKEND.DTO.orderItemDTOs.OrderItemResponseDTO;
import daviderocca.CAPSTONE_BACKEND.enums.OrderStatus;

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