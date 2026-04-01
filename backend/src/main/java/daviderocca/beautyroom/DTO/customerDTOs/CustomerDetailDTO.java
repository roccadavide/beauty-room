package daviderocca.beautyroom.DTO.customerDTOs;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record CustomerDetailDTO(
        UUID customerId,
        String fullName,
        String phone,
        String email,
        String notes,
        int totalBookings,
        int completedBookings,
        int cancelledBookings,
        List<ActivePackageDTO> packages,
        List<RecentBookingDTO> bookings
) {

    /** One active PackageCredit the customer currently holds. */
    public record ActivePackageDTO(
            UUID packageCreditId,
            String serviceOptionName,
            int sessionsRemaining,
            int sessionsTotal,
            LocalDateTime expiryDate
    ) {}

    /** One entry in the customer's booking history (last 5). */
    public record RecentBookingDTO(
            UUID bookingId,
            LocalDateTime startTime,
            String bookingStatus,
            String serviceTitle,
            String optionName
    ) {}
}