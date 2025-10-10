package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.NewOrderDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.OrderResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.OrderStatus;
import daviderocca.CAPSTONE_BACKEND.services.OrderService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
@Slf4j
public class OrderController {

    @Autowired
    private OrderService orderService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<OrderResponseDTO>> getAllOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "customerName") String sort
    ) {
        log.info("Richiesta elenco ordini [page={}, size={}, sort={}]", page, size, sort);
        return ResponseEntity.ok(orderService.findAllOrders(page, size, sort));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderResponseDTO> getOrderById(@PathVariable UUID orderId) {
        log.info("Richiesta dettaglio ordine {}", orderId);
        return ResponseEntity.ok(orderService.findOrderByIdAndConvert(orderId));
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<List<OrderResponseDTO>> getOrdersByEmail(@PathVariable String email) {
        log.info("Richiesta ordini per email {}", email);
        return ResponseEntity.ok(orderService.findOrdersByEmailAndConvert(email));
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping
    public ResponseEntity<OrderResponseDTO> createOrder(
            @Valid @RequestBody NewOrderDTO payload,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("🛒 Creazione nuovo ordine per {}", payload.customerEmail());
        OrderResponseDTO createdOrder = orderService.saveOrder(payload, currentUser);
        return ResponseEntity.status(201).body(createdOrder);
    }

    // ---------------------------------- PATCH ----------------------------------

    @PatchMapping("/{orderId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<OrderResponseDTO> updateOrderStatus(
            @PathVariable UUID orderId,
            @RequestParam @NotBlank OrderStatus status
    ) {
        log.info("Aggiornamento stato ordine {} -> {}", orderId, status);
        return ResponseEntity.ok(orderService.updateOrderStatus(orderId, status));
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{orderId}")
    public ResponseEntity<Void> deleteOrder(
            @PathVariable UUID orderId,
            @AuthenticationPrincipal User currentUser
    ) {
        log.info("Richiesta eliminazione ordine {}", orderId);
        orderService.findOrderByIdAndDelete(orderId, currentUser);
        return ResponseEntity.noContent().build();
    }
}