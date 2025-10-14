package daviderocca.CAPSTONE_BACKEND.DTO.orderItemDTOs;


import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record NewOrderItemDTO (
                               @NotNull(message = "La quantità dei prodotti non può essere vuota")
                               @Min(value = 1, message = "La quantità deve essere almeno 1")
                               int quantity,
                               @NotNull(message = "ID del prodotto è obbligatorio")
                               UUID productId
)
{}
