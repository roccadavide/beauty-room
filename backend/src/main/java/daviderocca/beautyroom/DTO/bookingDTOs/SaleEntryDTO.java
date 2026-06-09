package daviderocca.beautyroom.DTO.bookingDTOs;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Per-product entry in a multi-service booking request (BE-2 / scope A, Option A).
 * A standalone product sale that rides along in the booking create/update payload
 * and is reconciled like packages/promos (reconcile logic lands in BE-3).
 * Mirrors {@link ServiceEntryDTO}'s role for the drawer's product line.
 */
public record SaleEntryDTO(
        UUID productId,
        int quantity,
        BigDecimal unitPrice,
        boolean paid
) {}
