package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.NewOrderItemDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.OrderItemResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Order;
import daviderocca.CAPSTONE_BACKEND.entities.OrderItem;
import daviderocca.CAPSTONE_BACKEND.entities.Product;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.OrderItemRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
@Slf4j
public class OrderItemService {

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private ProductService productService;

    @Autowired
    private OrderService orderService;

    public Page<OrderItemResponseDTO> findAllOrderItems(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<OrderItem> page = this.orderItemRepository.findAll(pageable);

        return page.map(orderItem -> new OrderItemResponseDTO(
                orderItem.getOrderItemId(),
                orderItem.getQuantity(),
                orderItem.getPrice(),
                orderItem.getProduct() != null ? orderItem.getProduct().getProductId() : null,
                orderItem.getOrder() != null ? orderItem.getOrder().getOrderId() : null
        ));
    }

    public OrderItem findOrderItemById(UUID orderItemId) {
        return this.orderItemRepository.findById(orderItemId).orElseThrow(()-> new ResourceNotFoundException(orderItemId));
    }

    public OrderItemResponseDTO findOrderItemByIdAndConvert(UUID orderItemId) {
        OrderItem found = this.orderItemRepository.findById(orderItemId).orElseThrow(()-> new ResourceNotFoundException(orderItemId));

        return new OrderItemResponseDTO(
                found.getOrderItemId(),
                found.getQuantity(),
                found.getPrice(),
                found.getProduct() != null ? found.getProduct().getProductId() : null,
                found.getOrder() != null ? found.getOrder().getOrderId() : null
        );
    }

    public OrderItemResponseDTO saveOrderItem(NewOrderItemDTO payload, Order order) {

        Product relatedProduct = productService.findProductById(payload.productId());
        if (relatedProduct == null) {
            throw new IllegalArgumentException("Prodotto non trovato per ID: " + payload.productId());
        }

        OrderItem newOrderItem = new OrderItem(payload.quantity(), relatedProduct.getPrice(), relatedProduct, order);
        OrderItem savedOrderItem = orderItemRepository.save(newOrderItem);

        log.info("OrderItem {} salvato per ordine {} e prodotto {}", savedOrderItem.getOrderItemId(), order.getOrderId(), relatedProduct.getProductId());

        return new OrderItemResponseDTO(savedOrderItem.getOrderItemId(), savedOrderItem.getQuantity(),
                savedOrderItem.getPrice(), relatedProduct.getProductId(), order.getOrderId());
    }

    @Transactional
    public OrderItemResponseDTO findOrderItemByIdAndUpdate(UUID orderItemId, NewOrderItemDTO payload, Order order) {
        OrderItem found = findOrderItemById(orderItemId);

        Product relatedProduct = productService.findProductById(payload.productId());

        if (relatedProduct == null) {
            throw new IllegalArgumentException("Prodotto non trovato per ID: " + payload.productId());
        }

        found.setQuantity(payload.quantity());
        found.setPrice(relatedProduct.getPrice());
        found.setProduct(relatedProduct);
        found.setOrder(order);

        OrderItem modifiedOrderItem = orderItemRepository.save(found);

        log.info("OrderItem {} modificato per ordine {} e prodotto {}", modifiedOrderItem.getOrderItemId(), order.getOrderId(), relatedProduct.getProductId());

        return new OrderItemResponseDTO(modifiedOrderItem.getOrderItemId(), modifiedOrderItem.getQuantity(),
                modifiedOrderItem.getPrice(), relatedProduct.getProductId(), order.getOrderId());
    }

    @Transactional
    public void findOrderItemByIdAndDelete(UUID orderItemId) {
        OrderItem found = findOrderItemById(orderItemId);
        orderItemRepository.delete(found);
        log.info("OrderItem {} è stato eliminato!", found.getOrderItemId());
    }

}
