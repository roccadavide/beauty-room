package daviderocca.beautyroom;

import daviderocca.beautyroom.DTO.orderDTOs.NewOrderDTO;
import daviderocca.beautyroom.DTO.orderDTOs.OrderResponseDTO;
import daviderocca.beautyroom.DTO.orderItemDTOs.NewOrderItemDTO;
import daviderocca.beautyroom.entities.Category;
import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.enums.OrderStatus;
import daviderocca.beautyroom.repositories.CategoryRepository;
import daviderocca.beautyroom.repositories.OrderRepository;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.services.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class OrderServiceIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    private Product product;
    private static final BigDecimal PRODUCT_PRICE = new BigDecimal("19.99");
    private static final int QUANTITY = 2;

    @BeforeEach
    void setUp() {
        Category category = new Category("test-cat", "Test Category");
        category = categoryRepository.save(category);

        product = new Product(
                "Test Product",
                PRODUCT_PRICE,
                "Short",
                "Description",
                List.of("http://example.com/img.png"),
                10,
                category
        );
        product = productRepository.save(product);
    }

    @Test
    void saveOrder_createsOrderWithCorrectTotalAndPersists() {
        NewOrderDTO payload = new NewOrderDTO(
                "Mario",
                "Rossi",
                "mario@test.local",
                "+393331112233",
                "Note ritiro",
                List.of(new NewOrderItemDTO(QUANTITY, product.getProductId()))
        );

        OrderResponseDTO result = orderService.saveOrder(payload, null);

        assertThat(result).isNotNull();
        assertThat(result.orderId()).isNotNull();
        assertThat(result.orderStatus()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(result.customerEmail()).isEqualTo("mario@test.local");
        assertThat(result.orderItems()).hasSize(1);

        BigDecimal expectedTotal = PRODUCT_PRICE.multiply(BigDecimal.valueOf(QUANTITY));
        BigDecimal actualTotal = result.orderItems().stream()
                .map(item -> item.price().multiply(BigDecimal.valueOf(item.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(actualTotal).isEqualByComparingTo(expectedTotal);

        assertThat(orderRepository.findById(result.orderId())).isPresent();
    }
}
