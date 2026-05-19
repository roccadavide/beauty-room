package daviderocca.beautyroom.DTO.bookingDTOs;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Summary of a ClientPackageAssignment attached to a booking.
 * <p>
 * {@code sessionPrice} is the catalog per-session price (option price if the package
 * targets a specific option, else the underlying service's price). Used by the admin
 * agenda's "incasso stimato" to add the package's per-session contribution alongside
 * any extra catalog services on the booking. Null when neither the option nor the
 * service has a usable price (e.g. truly custom free-form packages).
 */
public record PackageSummaryDTO(
        UUID packageAssignmentId,
        String packageName,
        int sessionsRemaining,
        BigDecimal sessionPrice
) {}
