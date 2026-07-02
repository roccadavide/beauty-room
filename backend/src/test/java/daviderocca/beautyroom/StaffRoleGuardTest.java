package daviderocca.beautyroom;

import daviderocca.beautyroom.entities.Order;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.OrderStatus;
import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.exceptions.UnauthorizedException;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.OrderRepository;
import daviderocca.beautyroom.services.BookingService;
import daviderocca.beautyroom.services.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Prompt 02 — service-layer guard tests for the new isStaffOrAdmin helpers.
 *
 * <p>Each guard is the first (or near-first) check of its method, so a STAFF caller
 * that gets PAST it fails on the NEXT validation (BadRequest / ResourceNotFound),
 * never on UnauthorizedException — that is the assertion pattern used here. The
 * owner-only guard (hardDeleteBooking) must keep rejecting STAFF at service level
 * even though the controller annotation also blocks it (defense in depth).</p>
 */
@ExtendWith(MockitoExtension.class)
class StaffRoleGuardTest {

    @Mock
    private BookingRepository bookingRepository;
    @InjectMocks
    private BookingService bookingService;

    @Mock
    private OrderRepository orderRepository;
    @InjectMocks
    private OrderService orderService;

    private User admin;
    private User staff;
    private User customer;

    @BeforeEach
    void fixtures() {
        admin = user(Role.ADMIN);
        staff = user(Role.STAFF);
        customer = user(Role.CUSTOMER);
    }

    private static User user(Role role) {
        User u = new User("Test", role.name(), role.name().toLowerCase() + "@guard.local", "pwd", "+39333" + role.ordinal());
        u.setRole(role);
        // userId is @GeneratedValue with no setter; the admin-or-owner guards read it.
        ReflectionTestUtils.setField(u, "userId", UUID.randomUUID());
        return u;
    }

    // ---------- BookingService: shared daily-ops guards accept STAFF ----------

    @Test
    @DisplayName("updateBookingStatus: STAFF passes the role guard (fails on the next validation, not authorization)")
    void updateBookingStatus_staffPassesGuard() {
        assertThatThrownBy(() -> bookingService.updateBookingStatus(UUID.randomUUID(), null, staff))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("updateBookingStatus: CUSTOMER is rejected")
    void updateBookingStatus_customerRejected() {
        assertThatThrownBy(() -> bookingService.updateBookingStatus(UUID.randomUUID(), null, customer))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("settleBookingLines: STAFF passes the role guard")
    void settle_staffPassesGuard() {
        assertThatThrownBy(() -> bookingService.settleBookingLines(UUID.randomUUID(), null, staff))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("settleBookingLines: CUSTOMER is rejected")
    void settle_customerRejected() {
        assertThatThrownBy(() -> bookingService.settleBookingLines(UUID.randomUUID(), null, customer))
                .isInstanceOf(UnauthorizedException.class);
    }

    // ---------- BookingService: owner-only guard keeps rejecting STAFF ----------

    @Test
    @DisplayName("hardDeleteBooking: STAFF stays rejected at service level (owner-only)")
    void hardDelete_staffRejected() {
        assertThatThrownBy(() -> bookingService.hardDeleteBooking(UUID.randomUUID(), staff))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("hardDeleteBooking: ADMIN passes the role guard (fails on missing booking)")
    void hardDelete_adminPassesGuard() {
        when(bookingRepository.findById(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> bookingService.hardDeleteBooking(UUID.randomUUID(), admin))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---------- OrderService ----------

    @Test
    @DisplayName("cancelOrder: STAFF passes the role guard on a foreign order (fails on order state)")
    void cancelOrder_staffPassesGuard() {
        Order completed = new Order();
        completed.setOrderStatus(OrderStatus.COMPLETED);
        when(orderRepository.findById(any())).thenReturn(Optional.of(completed));

        assertThatThrownBy(() -> orderService.cancelOrder(UUID.randomUUID(), staff, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("cancelOrder: CUSTOMER cannot cancel a foreign order")
    void cancelOrder_customerRejectedOnForeignOrder() {
        Order completed = new Order();
        completed.setOrderStatus(OrderStatus.COMPLETED);
        when(orderRepository.findById(any())).thenReturn(Optional.of(completed));

        assertThatThrownBy(() -> orderService.cancelOrder(UUID.randomUUID(), customer, null))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("createManualOrder: CUSTOMER is rejected by the shared guard")
    void createManualOrder_customerRejected() {
        assertThatThrownBy(() -> orderService.createManualOrder(null, customer))
                .isInstanceOf(UnauthorizedException.class);
    }
}
