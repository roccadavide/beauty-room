package daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs;

public record BookingSummaryDTO(
        BookingResponseDTO booking,
        String paymentStatus,
        String customerEmail
) {
    public static BookingSummaryDTO error(String msg) {
        return new BookingSummaryDTO(null, "ERROR: " + msg, null);
    }
}