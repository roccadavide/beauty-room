package daviderocca.beautyroom.services;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import daviderocca.beautyroom.DTO.orderDTOs.NewOrderDTO;
import daviderocca.beautyroom.DTO.orderDTOs.OrderResponseDTO;
import daviderocca.beautyroom.DTO.orderItemDTOs.NewOrderItemDTO;
import daviderocca.beautyroom.DTO.orderItemDTOs.OrderItemResponseDTO;
import daviderocca.beautyroom.entities.Order;
import daviderocca.beautyroom.entities.OrderItem;
import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.entities.Promotion;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.NotificationType;
import daviderocca.beautyroom.enums.OrderStatus;
import daviderocca.beautyroom.enums.PaymentMethod;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.DuplicateResourceException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.exceptions.UnauthorizedException;
import daviderocca.beautyroom.email.outbox.EmailOutboxService;
import daviderocca.beautyroom.repositories.OrderRepository;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.repositories.PromotionRepository;
import daviderocca.beautyroom.repositories.UserRepository;
import daviderocca.beautyroom.util.PricingUtils;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductService productService;
    private final ProductRepository productRepository;
    private final EmailOutboxService emailOutboxService;
    private final AdminNotificationService notificationService;
    private final PromotionRepository promotionRepository;
    private final UserRepository userRepository;

    @Value("${stripe.secret}")
    private String stripeSecretKey;

    @PostConstruct
    public void init() {
        Stripe.apiKey = this.stripeSecretKey;
    }

    private static final int PENDING_EXPIRE_MINUTES = 30;

    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED_TRANSITIONS = Map.of(
            OrderStatus.PENDING_PAYMENT,     Set.of(OrderStatus.PAID_PENDING_PICKUP, OrderStatus.CANCELED, OrderStatus.FAILED),
            OrderStatus.PAID_PENDING_PICKUP, Set.of(OrderStatus.COMPLETED, OrderStatus.CANCELED)
    );

    // ---------------------------- FIND ----------------------------
    @Transactional(readOnly = true)
    public Page<OrderResponseDTO> findAllOrders(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort).descending());
        Page<Order> page = orderRepository.findAllWithDetails(pageable);
        List<OrderResponseDTO> dtoList = page.getContent().stream().map(this::convertToDTO).toList();
        return new PageImpl<>(dtoList, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Order findOrderById(UUID orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(orderId));
    }

    @Transactional(readOnly = true)
    public OrderResponseDTO findOrderByIdAndConvert(UUID orderId) {
        Order order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(orderId));
        return convertToDTO(order);
    }

    @Transactional(readOnly = true)
    public OrderResponseDTO findOrderByIdAndConvertSecure(UUID orderId, User currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new UnauthorizedException("Utente non autenticato.");
        }

        Order found = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(orderId));

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

        return orderRepository.findByUser_UserIdWithDetails(currentUser.getUserId())
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
            if (!product.isActive()) {
                throw new BadRequestException("Prodotto non disponibile: " + product.getName());
            }

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

    // ---------------------------- CREATE (PAY_IN_STORE — Cliente di Fiducia) ----------------------------
    @Transactional
    public OrderResponseDTO createPayInStoreOrder(NewOrderDTO payload, User currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new UnauthorizedException("Utente non autenticato.");
        }
        if (!currentUser.isVerified()) {
            throw new UnauthorizedException("Opzione non disponibile.");
        }
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

        newOrder.setOrderStatus(OrderStatus.PAID_PENDING_PICKUP);
        newOrder.setPaymentMethod(PaymentMethod.PAY_IN_STORE);
        newOrder.setExpiresAt(null);
        newOrder.setStripeSessionId(null);
        newOrder.setPaidAt(null);
        newOrder.setCanceledAt(null);
        newOrder.setCancelReason(null);

        for (NewOrderItemDTO itemDTO : payload.items()) {
            Product product = productService.findProductById(itemDTO.productId());
            if (!product.isActive()) {
                throw new BadRequestException("Prodotto non disponibile: " + product.getName());
            }
            if (product.getStock() < itemDTO.quantity()) {
                throw new BadRequestException("Stock insufficiente per il prodotto: " + product.getName());
            }
            product.setStock(product.getStock() - itemDTO.quantity());
            productRepository.save(product);

            OrderItem orderItem = new OrderItem(itemDTO.quantity(), product.getPrice(), product, newOrder);
            newOrder.getOrderItems().add(orderItem);
        }

        Order saved = orderRepository.save(newOrder);
        log.info("PAY_IN_STORE order created: id={} userId={}", saved.getOrderId(), currentUser.getUserId());

        try {
            emailOutboxService.enqueueOrderPaid(saved);
        } catch (Exception ex) {
            log.warn("enqueueOrderPaid failed for PAY_IN_STORE order {}: {}", saved.getOrderId(), ex.getMessage());
        }

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

        // regola base: non "riaprire" uno stato chiuso
        if (old == OrderStatus.CANCELED) throw new BadRequestException("Ordine CANCELED: non modificabile.");

        // valida transizione legale
        Set<OrderStatus> allowed = ALLOWED_TRANSITIONS.getOrDefault(old, Set.of());
        if (!allowed.contains(newStatus)) {
            throw new BadRequestException("Transizione non consentita: " + old + " -> " + newStatus);
        }

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
    public OrderResponseDTO cancelOrder(UUID orderId, User currentUser, String reason) {
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
            return findOrderByIdAndConvert(orderId);
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
        return findOrderByIdAndConvert(orderId);
    }

    // ---------------------------- ADMIN: refund ----------------------------
    @Transactional
    public OrderResponseDTO refundOrder(UUID orderId) throws StripeException {
        Order order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(orderId));

        OrderStatus status = order.getOrderStatus();

        if (status == OrderStatus.PENDING_PAYMENT) {
            releaseStock(order);
            order.setOrderStatus(OrderStatus.CANCELED);
            order.setCanceledAt(LocalDateTime.now());
            order.setCancelReason("ADMIN_REFUND_PENDING");
            order.setExpiresAt(null);
            orderRepository.save(order);
            log.info("Refund (pending): ordine annullato senza chiamata Stripe id={}", orderId);
            return findOrderByIdAndConvert(orderId);
        }

        if (status != OrderStatus.PAID_PENDING_PICKUP) {
            throw new BadRequestException("Rimborso possibile solo per ordini PAID o PENDING. Stato attuale: " + status);
        }

        String sessionId = order.getStripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            throw new BadRequestException("Nessuna sessione Stripe associata all'ordine.");
        }

        Session session = Session.retrieve(sessionId);
        String paymentIntentId = session.getPaymentIntent();
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new BadRequestException("Impossibile recuperare il PaymentIntent dalla sessione Stripe.");
        }

        // Fix 24: deterministic idempotency key so a re-issued refund (retry/double-click) returns the
        // same Stripe refund instead of creating a second one.
        RequestOptions refundOptions = RequestOptions.builder()
                .setIdempotencyKey("refund:" + paymentIntentId)
                .build();
        Refund.create(Map.of("payment_intent", paymentIntentId), refundOptions);

        order.setOrderStatus(OrderStatus.REFUNDED);
        orderRepository.save(order);
        log.info("Ordine rimborsato via Stripe: id={} paymentIntent={}", orderId, paymentIntentId);

        // PROMPT A: notifica cliente — rimborso ordine neutro confermato (con importo). Non-blocking:
        // lo Stripe refund è già andato a buon fine, un intoppo email non deve far rollback.
        try {
            emailOutboxService.enqueueOrderRefundConfirmed(order);
        } catch (Exception ex) {
            log.warn("enqueueOrderRefundConfirmed failed (non-blocking): orderId={} err={}", orderId, ex.getMessage());
        }

        return findOrderByIdAndConvert(orderId);
    }

    // ---------------------------- ADMIN: hard delete ----------------------------
    @Transactional
    public void deleteOrder(UUID orderId) {
        Order order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(orderId));

        OrderStatus status = order.getOrderStatus();
        if (status != OrderStatus.CANCELED && status != OrderStatus.COMPLETED) {
            throw new DuplicateResourceException("Annulla l'ordine prima di eliminarlo");
        }

        orderRepository.delete(order);
        log.info("Order hard deleted: id={}", orderId);
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

        // se è stato cancellato prima del pagamento, non "riapriamo"
        if (order.getOrderStatus() == OrderStatus.CANCELED) {
            log.warn("Webhook paid on canceled order: {}", orderId);
            return;
        }

        order.setOrderStatus(OrderStatus.PAID_PENDING_PICKUP);
        order.setPaidAt(LocalDateTime.now());
        order.setExpiresAt(null);

        orderRepository.save(order);

        try {
            emailOutboxService.enqueueOrderPaid(order);
        } catch (Exception ex) {
            log.warn("enqueueOrderPaid failed (non-blocking): orderId={} err={}", orderId, ex.getMessage());
        }

        try {
            notificationService.create(
                NotificationType.NEW_ORDER,
                "Nuovo ordine ricevuto 🛍️",
                (customerEmail != null ? customerEmail : "Cliente") + " · Ordine #" + orderId.toString().substring(0, 8),
                orderId,
                "ORDER"
            );
        } catch (Exception ex) {
            log.warn("Notification failed for order {}: {}", orderId, ex.getMessage());
        }

        log.info("Order paid: id={} email={}", orderId, customerEmail);
    }

    // ---------------------------- Stripe webhook: product-promo fulfillment ----------------------------

    /**
     * Crea (e segna pagato) l'ordine per una promo SOLO prodotti dopo il pagamento Stripe.
     * Idempotente per sessione Stripe: una replay non duplica ordine né scarico stock.
     * L'importo è ricalcolato server-side con la STESSA logica del checkout
     * ({@link PricingUtils#applyPromoDiscount}); il valore Stripe è solo un cross-check.
     * OrderItem richiede una FK prodotto non-null → si itemizza una riga per prodotto,
     * con prezzi che sommano ESATTAMENTE al totale arrotondato (resto sulla prima riga).
     *
     * @return l'ordine creato, oppure {@code null} se già evaso (no-op idempotente).
     */
    @Transactional
    public Order fulfillProductPromoOrder(UUID promotionId, UUID userIdOrNull,
                                          String customerName, String customerEmail, String customerPhone,
                                          String stripeSessionId, Long stripeAmountTotalCents) {

        // 1) Idempotenza: un solo ordine per sessione Stripe.
        Optional<Order> existing = orderRepository.findByStripeSessionId(stripeSessionId);
        if (existing.isPresent()) {
            log.info("Promo product order già evaso per sessione {} (skip)", stripeSessionId);
            return null;
        }

        // 2) Carica la promo (prodotti LAZY: accessibili in questa transazione).
        Promotion promo = promotionRepository.findByIdWithDetails(promotionId)
                .orElseThrow(() -> new ResourceNotFoundException(promotionId));
        List<Product> promoProducts = new ArrayList<>(promo.getProducts());
        if (promoProducts.isEmpty()) {
            throw new BadRequestException("Promo prodotti senza prodotti: " + promotionId);
        }

        // 3) Ricalcolo autorevole (stessa logica del checkout) + cross-check con Stripe.
        BigDecimal productTotal = promoProducts.stream()
                .map(p -> p.getPrice() != null ? p.getPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total = PricingUtils.applyPromoDiscount(productTotal, promo.getDiscountType(), promo.getDiscountValue());
        if (total == null || total.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Importo promo non valido: " + promotionId);
        }
        long recomputedCents = total.movePointRight(2).longValueExact();
        if (stripeAmountTotalCents != null && stripeAmountTotalCents != recomputedCents) {
            log.warn("Promo {} importo Stripe={} != ricalcolo server={} (uso il ricalcolo server)",
                    promotionId, stripeAmountTotalCents, recomputedCents);
        }

        // 4) Collega all'utente loggato se presente nei metadata, altrimenti ordine guest.
        User user = userIdOrNull != null ? userRepository.findById(userIdOrNull).orElse(null) : null;

        Order order = new Order(
                (customerName != null && !customerName.isBlank()) ? customerName : "Cliente",
                "",                                              // cognome non disponibile da Stripe
                customerEmail,
                customerPhone != null ? customerPhone : "",
                null,                                            // pickupNote
                user
        );
        order.setOrderStatus(OrderStatus.PAID_PENDING_PICKUP);
        order.setPaymentMethod(PaymentMethod.PAID_ONLINE);
        order.setStripeSessionId(stripeSessionId);
        order.setPaidAt(LocalDateTime.now());
        order.setExpiresAt(null);

        // 5) Una riga per prodotto (FK obbligatoria) + scarico stock. Ordine già pagato:
        //    non blocchiamo se lo stock è insufficiente, ma logghiamo (oversell).
        List<BigDecimal> lines = distributePromoLines(total, promoProducts);
        for (int i = 0; i < promoProducts.size(); i++) {
            Product product = productService.findProductById(promoProducts.get(i).getProductId());
            if (product.getStock() < 1) {
                log.warn("Stock insufficiente al fulfillment promo: product={} stock={}",
                        product.getProductId(), product.getStock());
            }
            product.setStock(product.getStock() - 1);
            productRepository.save(product);

            OrderItem item = new OrderItem(1, lines.get(i), product, order);
            order.getOrderItems().add(item);
        }

        Order saved = orderRepository.save(order);
        log.info("Promo product order creato: id={} total={} sessione={}", saved.getOrderId(), total, stripeSessionId);

        // 6) Email conferma + notifica admin (non bloccanti, come il flusso ordine normale).
        try {
            emailOutboxService.enqueueOrderPaid(saved);
        } catch (Exception ex) {
            log.warn("enqueueOrderPaid (promo) failed: orderId={} err={}", saved.getOrderId(), ex.getMessage());
        }
        try {
            notificationService.create(
                NotificationType.NEW_ORDER,
                "Nuovo ordine ricevuto 🛍️",
                (customerEmail != null ? customerEmail : "Cliente") + " · Promo #" + saved.getOrderId().toString().substring(0, 8),
                saved.getOrderId(),
                "ORDER"
            );
        } catch (Exception ex) {
            log.warn("Notification (promo) failed for order {}: {}", saved.getOrderId(), ex.getMessage());
        }

        return saved;
    }

    /**
     * Ripartisce il totale arrotondato sulle righe-prodotto in modo che la somma sia
     * ESATTA: le righe 2..n proporzionali al prezzo pieno, il resto sulla PRIMA riga.
     */
    private List<BigDecimal> distributePromoLines(BigDecimal total, List<Product> products) {
        int n = products.size();
        BigDecimal fullTotal = products.stream()
                .map(p -> p.getPrice() != null ? p.getPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal[] lines = new BigDecimal[n];
        BigDecimal allocatedToRest = BigDecimal.ZERO;
        for (int i = 1; i < n; i++) {
            BigDecimal price = products.get(i).getPrice() != null ? products.get(i).getPrice() : BigDecimal.ZERO;
            BigDecimal share = fullTotal.compareTo(BigDecimal.ZERO) == 0
                    ? total.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP)
                    : price.multiply(total).divide(fullTotal, 2, RoundingMode.HALF_UP);
            lines[i] = share;
            allocatedToRest = allocatedToRest.add(share);
        }
        lines[0] = total.subtract(allocatedToRest).setScale(2, RoundingMode.HALF_UP); // resto sulla prima riga
        return Arrays.asList(lines);
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