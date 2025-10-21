package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs.NewOrderDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderDTOs.OrderResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderItemDTOs.NewOrderItemDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.orderItemDTOs.OrderItemResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.*;
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

import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;

    private final ProductService productService;

    private final ProductRepository productRepository;

    // ---------------------------- FIND METHODS ----------------------------
    @Transactional(readOnly = true)
    public Page<OrderResponseDTO> findAllOrders(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<Order> page = orderRepository.findAll(pageable);
        return page.map(this::convertToDTO);
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
    public List<OrderResponseDTO> findOrdersByEmailAndConvert(String customerEmail) {
        return orderRepository.findByCustomerEmail(customerEmail)
                .stream()
                .map(this::convertToDTO)
                .toList();
    }

    // ---------------------------- CREATE ----------------------------
    @Transactional
    public OrderResponseDTO saveOrder(NewOrderDTO payload, User currentUser) {
        if (payload.items() == null || payload.items().isEmpty()) {
            throw new IllegalArgumentException("L'ordine deve contenere almeno un prodotto.");
        }

        Order newOrder = new Order(
                payload.customerName(),
                payload.customerSurname(),
                payload.customerEmail(),
                payload.customerPhone(),
                payload.pickupNote(),
                currentUser
        );

        // Gestione prodotti e stock
        for (NewOrderItemDTO itemDTO : payload.items()) {
            Product product = productService.findProductById(itemDTO.productId());

            if (product.getStock() < itemDTO.quantity()) {
                throw new IllegalStateException("Stock insufficiente per il prodotto: " + product.getName());
            }

            product.setStock(product.getStock() - itemDTO.quantity());
            productRepository.save(product);

            OrderItem orderItem = new OrderItem(itemDTO.quantity(), product.getPrice(), product, newOrder);
            newOrder.getOrderItems().add(orderItem);
        }

        Order saved = orderRepository.save(newOrder);
        log.info("Ordine {} creato con successo (stato: {}).", saved.getOrderId(), saved.getOrderStatus());
        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE STATUS ----------------------------
    @Transactional
    public OrderResponseDTO updateOrderStatus(UUID orderId, OrderStatus newStatus) {
        Order found = findOrderById(orderId);

        if (found.getOrderStatus() == OrderStatus.CANCELED || found.getOrderStatus() == OrderStatus.COMPLETED) {
            throw new BadRequestException("Impossibile aggiornare un ordine in stato: " + found.getOrderStatus());
        }

        found.setOrderStatus(newStatus);
        Order updated = orderRepository.save(found);

        log.info("Stato ordine {} aggiornato a {}", updated.getOrderId(), updated.getOrderStatus());
        return convertToDTO(updated);
    }

    // ---------------------------- DELETE ORDER ----------------------------
    @Transactional
    public void findOrderByIdAndDelete(UUID orderId, User currentUser) {
        Order found = findOrderById(orderId);

        boolean isAdmin = currentUser.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_ADMIN"));

        if (!isAdmin && (found.getUser() == null || !found.getUser().getUserId().equals(currentUser.getUserId()))) {
            throw new UnauthorizedException("Non puoi eliminare un ordine che non ti appartiene.");
        }

        if (found.getOrderStatus() == OrderStatus.COMPLETED || found.getOrderStatus() == OrderStatus.CANCELED) {
            throw new BadRequestException("Non è possibile eliminare un ordine in stato: " + found.getOrderStatus());
        }

        // Ripristino stock prodotti
        for (OrderItem item : found.getOrderItems()) {
            Product product = item.getProduct();
            product.setStock(product.getStock() + item.getQuantity());
            productRepository.save(product);
        }

        orderRepository.delete(found);
        log.info("Ordine {} eliminato correttamente e stock ripristinato.", found.getOrderId());
    }

    // ---------------------------- STRIPE ----------------------------
    @Transactional
    public void markOrderAsPaid(UUID orderId, String customerEmail) {
        Order order = findOrderById(orderId);

        if (order.getOrderStatus() == OrderStatus.COMPLETED) {
            log.warn("Ordine {} già completato, nessun aggiornamento necessario.", orderId);
            return;
        }

        if (order.getOrderStatus() == OrderStatus.CANCELED) {
            throw new BadRequestException("Impossibile completare un ordine annullato.");
        }

        order.setOrderStatus(OrderStatus.COMPLETED);
        orderRepository.save(order);

        log.info("Ordine {} segnato come COMPLETED (cliente: {})", orderId, customerEmail);
    }

    // ---------------------------- CONVERTER ----------------------------
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