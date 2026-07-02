package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.BookingSaleDTO;
import daviderocca.beautyroom.entities.BookingSale;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.BookingSaleRepository;
import daviderocca.beautyroom.repositories.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/bookings")
@PreAuthorize("hasAnyRole('ADMIN','STAFF')")
@RequiredArgsConstructor
public class BookingSaleController {

    private final BookingSaleRepository saleRepo;
    private final ProductRepository productRepository;
    private final BookingRepository bookingRepository;

    @GetMapping("/{bookingId}/sales")
    public List<BookingSale> getSales(@PathVariable UUID bookingId) {
        return saleRepo.findByBookingIdOrderByAddedAtDesc(bookingId);
    }

    @PostMapping("/{bookingId}/sales")
    @Transactional
    public ResponseEntity<BookingSale> addSale(
            @PathVariable UUID bookingId,
            @RequestBody BookingSaleDTO dto
    ) {
        if (dto.getProductId() == null || dto.getProductName() == null || dto.getUnitPrice() == null) {
            return ResponseEntity.badRequest().build();
        }

        BookingSale sale = new BookingSale();
        sale.setBookingId(bookingId);
        sale.setProductId(dto.getProductId());
        sale.setProductName(dto.getProductName());
        sale.setQuantity(Math.max(1, dto.getQuantity()));
        sale.setUnitPrice(dto.getUnitPrice());

        // R9: quick-add sale inherits the booking's staff (same site-family as the three
        // BookingService sale sites from prompt 01), so no NULL staff_id rows accumulate.
        bookingRepository.findById(bookingId)
                .ifPresent(b -> sale.setStaffMember(b.getStaffMember()));

        BookingSale saved = saleRepo.save(sale);

        // Standalone quick-add sale holds -qty of stock (same invariant as the drawer, BE-3).
        // No floor guard: client prevents oversell, @Version handles races; may go negative
        // to keep the BE-5 restore symmetric.
        productRepository.findById(sale.getProductId()).ifPresent(p -> {
            p.setStock(p.getStock() - sale.getQuantity());
            productRepository.save(p);
        });

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @DeleteMapping("/{bookingId}/sales/{saleId}")
    @Transactional
    public ResponseEntity<Void> deleteSale(
            @PathVariable UUID bookingId,
            @PathVariable UUID saleId
    ) {
        // Restore stock only for standalone sales (promotion_link_id IS NULL); promo
        // product-lines are restored by the promo path, so this guard avoids double-restore.
        saleRepo.findById(saleId)
                .filter(s -> bookingId.equals(s.getBookingId()))
                .filter(s -> s.getPromotionLinkId() == null)
                .ifPresent(s -> productRepository.findById(s.getProductId()).ifPresent(p -> {
                    p.setStock(p.getStock() + s.getQuantity());
                    productRepository.save(p);
                }));

        saleRepo.deleteByIdAndBookingId(saleId, bookingId);
        return ResponseEntity.noContent().build();
    }
}
