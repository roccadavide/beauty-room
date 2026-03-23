package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.BookingSaleDTO;
import daviderocca.CAPSTONE_BACKEND.entities.BookingSale;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingSaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/bookings")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class BookingSaleController {

    private final BookingSaleRepository saleRepo;

    @GetMapping("/{bookingId}/sales")
    public List<BookingSale> getSales(@PathVariable UUID bookingId) {
        return saleRepo.findByBookingIdOrderByAddedAtDesc(bookingId);
    }

    @PostMapping("/{bookingId}/sales")
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

        return ResponseEntity.status(HttpStatus.CREATED).body(saleRepo.save(sale));
    }

    @DeleteMapping("/{bookingId}/sales/{saleId}")
    public ResponseEntity<Void> deleteSale(
            @PathVariable UUID bookingId,
            @PathVariable UUID saleId
    ) {
        saleRepo.deleteByIdAndBookingId(saleId, bookingId);
        return ResponseEntity.noContent().build();
    }
}
