package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs.NewOrderDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs.OrderResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.OrderStatus;
import daviderocca.CAPSTONE_BACKEND.services.OrderService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
@Slf4j
public class OrderController {

    private final OrderService orderService;

    // ---------------------------------- ADMIN GET ----------------------------------
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<OrderResponseDTO>> getAllOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sort
    ) {
        log.info("ADMIN | list orders page={} size={} sort={}", page, size, sort);
        return ResponseEntity.ok(orderService.findAllOrders(page, size, sort));
    }

    // ---------------------------------- AUTH GET ----------------------------------
    @GetMapping("/{orderId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<OrderResponseDTO> getOrderById(
            @PathVariable UUID orderId,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("AUTH | detail order {}", orderId);
        return ResponseEntity.ok(orderService.findOrderByIdAndConvertSecure(orderId, currentUser));
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<OrderResponseDTO>> getMyOrders(@AuthenticationPrincipal User currentUser) {
        log.info("AUTH | my orders user={}", currentUser.getUserId());
        return ResponseEntity.ok(orderService.findMyOrdersAndConvert(currentUser));
    }

    // Ricerca per email: solo admin
    @GetMapping("/email/{email}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<OrderResponseDTO>> getOrdersByEmail(@PathVariable String email) {
        log.info("ADMIN | orders by email {}", email);
        return ResponseEntity.ok(orderService.findOrdersByEmailAndConvert(email));
    }

    // ---------------------------------- ADMIN POST (manual) ----------------------------------
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<OrderResponseDTO> createOrderManual(
            @Valid @RequestBody NewOrderDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("ADMIN | create manual order for {}", payload.customerEmail());
        OrderResponseDTO created = orderService.createManualOrder(payload, currentUser);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- ADMIN PATCH ----------------------------------
    @PatchMapping("/{orderId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<OrderResponseDTO> updateOrderStatus(
            @PathVariable UUID orderId,
            @RequestParam @NotBlank OrderStatus status
    ) {
        log.info("ADMIN | update order status {} -> {}", orderId, status);
        return ResponseEntity.ok(orderService.updateOrderStatus(orderId, status));
    }

    // ---------------------------------- AUTH CANCEL (soft) ----------------------------------
    // Nota: rimane DELETE per UX, ma semanticamente è CANCEL.
    @DeleteMapping("/{orderId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> cancelOrder(
            @PathVariable UUID orderId,
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String reason
    ) {
        log.info("AUTH | cancel order {} reason={}", orderId, reason);
        orderService.cancelOrder(orderId, currentUser, reason);
        return ResponseEntity.noContent().build();
    }
}