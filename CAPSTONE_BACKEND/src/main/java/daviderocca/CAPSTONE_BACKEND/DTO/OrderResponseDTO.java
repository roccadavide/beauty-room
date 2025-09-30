package daviderocca.CAPSTONE_BACKEND.DTO;

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
        String shippingAddress,
        String shippingCity,
        String shippingZip,
        String shippingCountry,
        OrderStatus orderStatus,
        LocalDateTime createdAt,
        UUID userId,
        List<OrderItemResponseDTO> orderItems
) {}