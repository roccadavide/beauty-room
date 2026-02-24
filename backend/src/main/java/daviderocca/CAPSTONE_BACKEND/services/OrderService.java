package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs.NewOrderDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs.OrderResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderItemDTOs.NewOrderItemDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderItemDTOs.OrderItemResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Order;
import daviderocca.CAPSTONE_BACKEND.entities.OrderItem;
import daviderocca.CAPSTONE_BACKEND.entities.Product;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.OrderStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.repositories.OrderRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductService productService;
    private final ProductRepository productRepository;

    private static final int PENDING_EXPIRE_MINUTES = 30;

    // ---------------------------- FIND ----------------------------
    @Transactional(readOnly = true)
    public Page<OrderResponseDTO> findAllOrders(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort).descending());
        return orderRepository.findAll(pageable).map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    public Order findOrderById(UUID orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(orderId));
    }

    @Transactional(readOnly = true)
    public OrderResponseDTO findOrderByIdAndConvert(UUID orderId) {
        return convertToDTO(findOrderById(orderId));
    }

    @Transactional(readOnly = true)
    public OrderResponseDTO findOrderByIdAndConvertSecure(UUID orderId, User currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new UnauthorizedException("Utente non autenticato.");
        }

        Order found = findOrderById(orderId);

        boolean isAdmin = isAdmin(currentUser);
        if (!isAdmin && (found.getUser() == null || !found.getUser().getUserId().equals(currentUser.getUserId()))) {
            throw new UnauthorizedException("Non puoi visualizzare un ordine che non ti appartiene.");
        }

        return convertToDTO(found);
    }

    @Transactional(readOnly = true)
    public List<OrderResponseDTO> findMyOrdersAndConvert(User currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new UnauthorizedException("Utente non autenticato.");
        }

        return orderRepository.findByUser_UserId(currentUser.getUserId())
                .stream()
                .map(this::convertToDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrderResponseDTO> findOrdersByEmailAndConvert(String customerEmail) {
        return orderRepository.findByCustomerEmail(customerEmail)
                .stream()
                .map(this::convertToDTO)
                .toList();
    }

    // ---------------------------- CREATE (Stripe flow) ----------------------------
    @Transactional
    public OrderResponseDTO saveOrder(NewOrderDTO payload, User currentUser) {
        if (payload.items() == null || payload.items().isEmpty()) {
            throw new BadRequestException("L'ordine deve contenere almeno un prodotto.");
        }

        Order newOrder = new Order(
                payload.customerName(),
                payload.customerSurname(),
                payload.customerEmail(),
                payload.customerPhone(),
                payload.pickupNote(),
                currentUser
        );

        newOrder.setOrderStatus(OrderStatus.PENDING_PAYMENT);
        newOrder.setExpiresAt(LocalDateTime.now().plusMinutes(PENDING_EXPIRE_MINUTES));
        newOrder.setStripeSessionId(null);
        newOrder.setPaidAt(null);
        newOrder.setCanceledAt(null);
        newOrder.setCancelReason(null);

        for (NewOrderItemDTO itemDTO : payload.items()) {
            Product product = productService.findProductById(itemDTO.productId());

            if (product.getStock() < itemDTO.quantity()) {
                throw new BadRequestException("Stock insufficiente per il prodotto: " + product.getName());
            }

            product.setStock(product.getStock() - itemDTO.quantity());
            productRepository.save(product);

            OrderItem orderItem = new OrderItem(itemDTO.quantity(), product.getPrice(), product, newOrder);
            newOrder.getOrderItems().add(orderItem);
        }

        Order saved = orderRepository.save(newOrder);
        log.info("Ordine creato: id={} status={}", saved.getOrderId(), saved.getOrderStatus());
        return convertToDTO(saved);
    }

    // ---------------------------- CREATE (manual admin) ----------------------------
    @Transactional
    public OrderResponseDTO createManualOrder(NewOrderDTO payload, User currentUser) {
        if (!isAdmin(currentUser)) {
            throw new UnauthorizedException("Solo ADMIN può creare ordini manuali.");
        }

        OrderResponseDTO created = saveOrder(payload, currentUser);

        // manuale: tipicamente già pagato in negozio
        updateOrderStatus(created.orderId(), OrderStatus.PAID_PENDING_PICKUP);

        return findOrderByIdAndConvert(created.orderId());
    }

    // ---------------------------- Stripe: attach session id ----------------------------
    @Transactional
    public void attachStripeSession(UUID orderId, String stripeSessionId) {
        if (stripeSessionId == null || stripeSessionId.trim().isEmpty()) {
            throw new BadRequestException("stripeSessionId non valido.");
        }

        Order order = findOrderById(orderId);

        if (order.getOrderStatus() != OrderStatus.PENDING_PAYMENT) {
            log.warn("attachStripeSession ignorato: orderId={} status={}", orderId, order.getOrderStatus());
            return;
        }

        order.setStripeSessionId(stripeSessionId.trim());
        orderRepository.save(order);

        log.info("Stripe session associata: orderId={} sessionId={}", orderId, stripeSessionId);
    }

    // ---------------------------- ADMIN: update status ----------------------------
    @Transactional
    public OrderResponseDTO updateOrderStatus(UUID orderId, OrderStatus newStatus) {
        if (newStatus == null) throw new BadRequestException("Status non valido.");

        Order found = findOrderById(orderId);
        OrderStatus old = found.getOrderStatus();

        if (old == newStatus) throw new BadRequestException("L'ordine è già nello stato richiesto.");
        if (old == OrderStatus.COMPLETED) throw new BadRequestException("Ordine COMPLETED: non modificabile.");

        // regola base: non “riaprire” uno stato chiuso
        if (old == OrderStatus.CANCELED) throw new BadRequestException("Ordine CANCELED: non modificabile.");

        // se stai annullando/fallendo PRIMA del pagamento -> rilascia stock
        if ((newStatus == OrderStatus.CANCELED || newStatus == OrderStatus.FAILED) && old == OrderStatus.PENDING_PAYMENT) {
            releaseStock(found);
            found.setCanceledAt(LocalDateTime.now());
            found.setCancelReason(newStatus == OrderStatus.CANCELED ? "MANUAL" : "PAYMENT_FAILED");
            found.setExpiresAt(null);
        }

        // paid: set paidAt e stop expires
        if (newStatus == OrderStatus.PAID_PENDING_PICKUP) {
            if (found.getPaidAt() == null) found.setPaidAt(LocalDateTime.now());
            found.setExpiresAt(null);
        }

        // refunded: NON gestiamo stock automaticamente
        if (newStatus == OrderStatus.REFUNDED) {
            // qui potresti aggiungere un refundedAt in entity, se vuoi.
        }

        found.setOrderStatus(newStatus);
        Order updated = orderRepository.save(found);

        log.info("Order status updated: id={} {} -> {}", updated.getOrderId(), old, newStatus);
        return convertToDTO(updated);
    }

    // ---------------------------- AUTH: cancel (soft) ----------------------------
    @Transactional
    public void cancelOrder(UUID orderId, User currentUser, String reason) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new UnauthorizedException("Utente non autenticato.");
        }

        Order found = findOrderById(orderId);

        boolean admin = isAdmin(currentUser);
        boolean owner = found.getUser() != null && found.getUser().getUserId().equals(currentUser.getUserId());

        if (!admin && !owner) {
            throw new UnauthorizedException("Non puoi annullare un ordine che non ti appartiene.");
        }

        if (found.getOrderStatus() == OrderStatus.COMPLETED) {
            throw new BadRequestException("Non puoi annullare un ordine COMPLETED.");
        }
        if (found.getOrderStatus() == OrderStatus.REFUNDED) {
            throw new BadRequestException("Non puoi annullare un ordine REFUNDED.");
        }
        if (found.getOrderStatus() == OrderStatus.CANCELED) {
            return;
        }
        if (found.getOrderStatus() == OrderStatus.PAID_PENDING_PICKUP) {
            throw new BadRequestException("Ordine già pagato: per annullarlo serve procedura di rimborso.");
        }

        // qui siamo praticamente in PENDING_PAYMENT
        if (found.getOrderStatus() == OrderStatus.PENDING_PAYMENT) {
            releaseStock(found);
        }

        found.setOrderStatus(OrderStatus.CANCELED);
        found.setCanceledAt(LocalDateTime.now());
        found.setCancelReason((reason == null || reason.trim().isEmpty()) ? "USER_CANCEL" : reason.trim());
        found.setExpiresAt(null);

        orderRepository.save(found);
        log.info("Order canceled: id={} reason={}", orderId, found.getCancelReason());
    }

    // ---------------------------- Stripe webhook: paid ----------------------------
    @Transactional
    public void markOrderAsPaid(UUID orderId, String customerEmail) {
        Order order = findOrderById(orderId);

        // idempotenza
        if (order.getOrderStatus() == OrderStatus.PAID_PENDING_PICKUP || order.getOrderStatus() == OrderStatus.COMPLETED) {
            log.warn("Webhook paid ignored: orderId={} status={}", orderId, order.getOrderStatus());
            return;
        }

        // se è stato cancellato prima del pagamento, non “riapriamo”
        if (order.getOrderStatus() == OrderStatus.CANCELED) {
            log.warn("Webhook paid on canceled order: {}", orderId);
            return;
        }

        order.setOrderStatus(OrderStatus.PAID_PENDING_PICKUP);
        order.setPaidAt(LocalDateTime.now());
        order.setExpiresAt(null);

        orderRepository.save(order);
        log.info("Order paid: id={} email={}", orderId, customerEmail);
    }

    // ---------------------------- Cancel from Stripe expired session ----------------------------
    @Transactional
    public boolean cancelIfPending(UUID orderId, String cancelReason) {
        Order order = findOrderById(orderId);
        if (order.getOrderStatus() != OrderStatus.PENDING_PAYMENT) return false;

        releaseStock(order);
        order.setOrderStatus(OrderStatus.CANCELED);
        order.setCanceledAt(LocalDateTime.now());
        order.setCancelReason(cancelReason);
        order.setExpiresAt(null);
        orderRepository.save(order);
        return true;
    }

    // ---------------------------- Expire pending (ready for scheduler) ----------------------------
    @Transactional
    public int expirePendingOrders() {
        LocalDateTime now = LocalDateTime.now();
        List<Order> expired = orderRepository.findByOrderStatusAndExpiresAtBefore(OrderStatus.PENDING_PAYMENT, now);

        for (Order o : expired) {
            if (o.getOrderStatus() != OrderStatus.PENDING_PAYMENT) continue;

            releaseStock(o);

            o.setOrderStatus(OrderStatus.CANCELED);
            o.setCanceledAt(now);
            o.setCancelReason("EXPIRED");
            o.setExpiresAt(null);
        }

        if (!expired.isEmpty()) {
            orderRepository.saveAll(expired);
            log.info("Expired pending orders: {}", expired.size());
        }

        return expired.size();
    }

    // ---------------------------- helpers ----------------------------
    private boolean isAdmin(User user) {
        return user != null && user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private void releaseStock(Order order) {
        if (order.getOrderItems() == null) return;

        for (OrderItem item : order.getOrderItems()) {
            Product product = item.getProduct();
            if (product == null) continue;

            product.setStock(product.getStock() + item.getQuantity());
            productRepository.save(product);
        }
    }

    private OrderResponseDTO convertToDTO(Order order) {
        List<OrderItemResponseDTO> itemDTOs = order.getOrderItems().stream()
                .map(item -> new OrderItemResponseDTO(
                        item.getOrderItemId(),
                        item.getQuantity(),
                        item.getPrice(),
                        item.getProduct().getProductId(),
                        order.getOrderId()
                ))
                .toList();

        return new OrderResponseDTO(
                order.getOrderId(),
                order.getCustomerName(),
                order.getCustomerSurname(),
                order.getCustomerEmail(),
                order.getCustomerPhone(),
                order.getPickupNote(),
                order.getOrderStatus(),
                order.getCreatedAt(),
                order.getUser() != null ? order.getUser().getUserId() : null,
                itemDTOs
        );
    }
}