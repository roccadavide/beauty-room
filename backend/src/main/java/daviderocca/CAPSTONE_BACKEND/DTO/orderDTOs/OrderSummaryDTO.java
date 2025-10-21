package daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs;

import java.util.List;

public record OrderSummaryDTO(
        String orderId,
        String status,            // es. "PAID" | "PENDING"
        String customerName,
        String customerEmail,
        String customerPhone,
        String pickupNote,
        List<Item> items,
        String totalFormatted,
        String message
) {
    public static OrderSummaryDTO from(OrderResponseDTO o, String status, String emailFromStripe) {
        var total = o.orderItems().stream()
                .map(i -> i.price().multiply(java.math.BigDecimal.valueOf(i.quantity())))
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        return new OrderSummaryDTO(
                o.orderId().toString(),
                status,
                o.customerName() + " " + o.customerSurname(),
                emailFromStripe != null ? emailFromStripe : o.customerEmail(),
                o.customerPhone(),
                o.pickupNote(),
                o.orderItems().stream().map(i ->
                        new Item(i.productId().toString(), i.quantity(), i.price())
                ).toList(),
                String.format("€ %.2f", total),
                null
        );
    }

    public static OrderSummaryDTO error(String message) {
        return new OrderSummaryDTO(null, "ERROR", null, null, null, null, List.of(), null, message);
    }

    public record Item(String productId, int quantity, java.math.BigDecimal price) {}
}
