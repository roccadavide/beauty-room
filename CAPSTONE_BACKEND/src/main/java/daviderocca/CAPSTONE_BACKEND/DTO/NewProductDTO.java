package daviderocca.CAPSTONE_BACKEND.DTO;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.UUID;

public record NewProductDTO (
                            @NotEmpty(message = "Il nome del prodotto non può essere vuoto")
                            String name,
                            @NotNull(message = "Il prezzo è obbligatorio")
                            @Positive(message = "Il prezzo deve essere un valore positivo")
                            BigDecimal price,
                            @NotEmpty(message = "La descrizione breve non può essere vuota")
                            String shortDescription,
                            @NotEmpty(message = "La descrizione non può essere vuota")
                            String description,
                            @NotNull(message = "Lo stock è obbligatorio")
                            @Positive(message = "Lo stock deve essere un numero positivo")
                            Integer stock,
                            @NotNull(message = "La categoria è obbligatoria")
                            UUID categoryId
)
{}