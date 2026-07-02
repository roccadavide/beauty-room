package daviderocca.beautyroom.exceptions;

import daviderocca.beautyroom.DTO.staffDTOs.BlockingBookingDTO;

import java.util.List;

/**
 * Deactivating a staff member is blocked by future CONFIRMED bookings
 * (decision #10). Maps to 409 with the blocking list in ApiError.details
 * so the UI can show what needs reassigning.
 */
public class StaffDeactivationBlockedException extends RuntimeException {

    private final transient List<BlockingBookingDTO> blockingBookings;

    public StaffDeactivationBlockedException(String message, List<BlockingBookingDTO> blockingBookings) {
        super(message);
        this.blockingBookings = blockingBookings;
    }

    public List<BlockingBookingDTO> getBlockingBookings() {
        return blockingBookings;
    }
}
