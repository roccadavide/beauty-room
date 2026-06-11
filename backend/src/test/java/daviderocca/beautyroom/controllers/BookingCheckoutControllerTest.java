package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.bookingDTOs.ProductEntryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PublicMultiServiceBookingDTO;
import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.repositories.PromotionRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import daviderocca.beautyroom.services.BookingService;
import daviderocca.beautyroom.services.ServiceItemService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Fix 3: the pre-payment stock guard in createSessionMulti rejects a mixed cart whose product stock
 * is short BEFORE any Stripe session is created (the throw precedes {@code Session.create}, so no
 * Stripe call is made and the {@code @Value} fields are irrelevant here).
 */
@ExtendWith(MockitoExtension.class)
class BookingCheckoutControllerTest {

    @Mock private BookingService bookingService;
    @Mock private ServiceItemService serviceItemService;
    @Mock private ServiceOptionRepository serviceOptionRepository;
    @Mock private PromotionRepository promotionRepository;
    @Mock private ProductRepository productRepository;
    @Mock private BookingRepository bookingRepository;

    @InjectMocks private BookingCheckoutController controller;

    @Test
    @DisplayName("Fix 3: createSessionMulti rejects when a product's stock < requested quantity")
    void createSessionMulti_rejectsWhenStockBelowQuantity() {
        UUID serviceId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        ServiceItem svc = mock(ServiceItem.class);
        when(svc.getPrice()).thenReturn(new BigDecimal("40.00"));
        when(svc.getTitle()).thenReturn("Manicure");
        when(serviceItemService.findServiceItemById(serviceId)).thenReturn(svc);

        Product product = new Product();
        setField(product, "productId", productId);
        product.setName("Smalto");
        product.setActive(true);
        product.setPrice(new BigDecimal("12.00"));
        product.setStock(1);
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        PublicMultiServiceBookingDTO payload = new PublicMultiServiceBookingDTO(
                "Mario Rossi", "mario@test.it", "3331234567", null,
                LocalDate.now().plusDays(1), LocalTime.of(10, 0),
                List.of(serviceId), 60, null,
                List.of(new ProductEntryDTO(productId, 3)), false, false,
                null); // serviceOptionIds null → base pricing; wants 3, only 1 in stock

        assertThatThrownBy(() -> controller.createSessionMulti(payload))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Smalto");
    }

    @Test
    @DisplayName("Fix 11: createSessionMulti rejects an option that does not belong to its service")
    void createSessionMulti_rejectsOptionNotBelongingToService() {
        UUID serviceId = UUID.randomUUID();
        UUID optionId  = UUID.randomUUID();

        ServiceItem svc = mock(ServiceItem.class);
        when(svc.getTitle()).thenReturn("Manicure");
        when(serviceItemService.findServiceItemById(serviceId)).thenReturn(svc);
        // Option id not owned by this service → the validate-by-query finder returns empty.
        when(serviceOptionRepository.findByOptionIdAndService_ServiceId(optionId, serviceId))
                .thenReturn(Optional.empty());

        PublicMultiServiceBookingDTO payload = new PublicMultiServiceBookingDTO(
                "Mario Rossi", "mario@test.it", "3331234567", null,
                LocalDate.now().plusDays(1), LocalTime.of(10, 0),
                List.of(serviceId), 30, null,
                null, false, false,
                List.of(optionId)); // serviceOptionIds index-aligned to serviceIds

        assertThatThrownBy(() -> controller.createSessionMulti(payload))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("non appartiene");
    }

    private static void setField(Object target, String name, Object value) {
        try {
            Field f = target.getClass().getDeclaredField(name);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException("setField failed for " + name, e);
        }
    }
}
