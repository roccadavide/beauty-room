package daviderocca.beautyroom;

import daviderocca.beautyroom.DTO.BookingSaleDTO;
import daviderocca.beautyroom.controllers.BookingSaleController;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.BookingSale;
import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.BookingSaleRepository;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.staff.StaffMember;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// =========================================================================
// BE-4: quick-add sales panel <-> Product.stock invariant.
// Standalone quick-add sale (promotion_link_id IS NULL) holds -qty of stock,
// mirroring the drawer reconcile (BE-3). Promo product-lines are owned by the
// promo path, so the quick-add DELETE must never restore them.
// =========================================================================
@ExtendWith(MockitoExtension.class)
class BookingSaleControllerTest {

    @Mock
    private BookingSaleRepository saleRepo;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private BookingRepository bookingRepository;

    @InjectMocks
    private BookingSaleController controller;

    @Test
    @DisplayName("BE-4: addSale decrements Product.stock by the sale quantity")
    void addSale_decrementsStockByQuantity() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Product product = new Product();
        product.setStock(10);

        BookingSaleDTO dto = new BookingSaleDTO();
        dto.setProductId(productId);
        dto.setProductName("Crema Viso");
        dto.setQuantity(3);
        dto.setUnitPrice(new BigDecimal("19.90"));

        when(saleRepo.save(any(BookingSale.class))).thenAnswer(inv -> inv.getArgument(0));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        ResponseEntity<BookingSale> resp = controller.addSale(bookingId, dto);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ArgumentCaptor<Product> pc = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(pc.capture());
        assertThat(pc.getValue().getStock()).isEqualTo(7); // 10 - 3

        verify(saleRepo).save(any(BookingSale.class));
    }

    @Test
    @DisplayName("R9: quick-added sale inherits the booking's staff")
    void addSale_inheritsBookingStaff() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        StaffMember staff = new StaffMember("Michela", true, 0);
        UUID staffId = UUID.randomUUID();
        staff.setId(staffId);

        Booking booking = new Booking();
        booking.setStaffMember(staff);

        Product product = new Product();
        product.setStock(10);

        BookingSaleDTO dto = new BookingSaleDTO();
        dto.setProductId(productId);
        dto.setProductName("Crema Viso");
        dto.setQuantity(1);
        dto.setUnitPrice(new BigDecimal("19.90"));

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(saleRepo.save(any(BookingSale.class))).thenAnswer(inv -> inv.getArgument(0));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        ResponseEntity<BookingSale> resp = controller.addSale(bookingId, dto);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ArgumentCaptor<BookingSale> sc = ArgumentCaptor.forClass(BookingSale.class);
        verify(saleRepo).save(sc.capture());
        assertThat(sc.getValue().getStaffMember()).isNotNull();
        assertThat(sc.getValue().getStaffMember().getId()).isEqualTo(staffId);
    }

    @Test
    @DisplayName("BE-4: deleteSale of a standalone sale restores Product.stock and deletes the row")
    void deleteSale_standalone_restoresStock() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID saleId = UUID.randomUUID();

        Product product = new Product();
        product.setStock(5);

        BookingSale sale = new BookingSale();
        sale.setBookingId(bookingId);
        sale.setProductId(productId);
        sale.setQuantity(2);
        // promotionLinkId stays null -> standalone

        when(saleRepo.findById(saleId)).thenReturn(Optional.of(sale));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        ResponseEntity<Void> resp = controller.deleteSale(bookingId, saleId);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ArgumentCaptor<Product> pc = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(pc.capture());
        assertThat(pc.getValue().getStock()).isEqualTo(7); // 5 + 2 restored

        verify(saleRepo).deleteByIdAndBookingId(saleId, bookingId);
    }

    @Test
    @DisplayName("BE-4: deleteSale of a promo sale does NOT restore stock but still deletes")
    void deleteSale_promoSale_doesNotRestoreStock() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID saleId = UUID.randomUUID();

        BookingSale sale = new BookingSale();
        sale.setBookingId(bookingId);
        sale.setProductId(productId);
        sale.setQuantity(2);
        sale.setPromotionLinkId(UUID.randomUUID()); // promo line -> not standalone

        when(saleRepo.findById(saleId)).thenReturn(Optional.of(sale));

        ResponseEntity<Void> resp = controller.deleteSale(bookingId, saleId);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        verify(productRepository, never()).findById(any());
        verify(productRepository, never()).save(any());
        verify(saleRepo).deleteByIdAndBookingId(saleId, bookingId);
    }

    @Test
    @DisplayName("BE-4: deleteSale does not restore when the sale belongs to another booking")
    void deleteSale_bookingMismatch_doesNotRestoreStock() {
        UUID bookingId = UUID.randomUUID();
        UUID otherBooking = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID saleId = UUID.randomUUID();

        BookingSale sale = new BookingSale();
        sale.setBookingId(otherBooking); // different booking
        sale.setProductId(productId);
        sale.setQuantity(2);

        when(saleRepo.findById(saleId)).thenReturn(Optional.of(sale));

        ResponseEntity<Void> resp = controller.deleteSale(bookingId, saleId);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        verify(productRepository, never()).save(any());
        verify(saleRepo).deleteByIdAndBookingId(saleId, bookingId);
    }
}
