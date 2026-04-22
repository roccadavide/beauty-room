package daviderocca.beautyroom.DTO.productDTOs;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record NewProductDTO (
                            @NotEmpty(message = "Il nome del prodotto non può essere vuoto")
                            String name,
                            @NotNull(message = "Il prezzo è obbligatorio")
                            @Positive(message = "Il prezzo deve essere un valore positivo")
                            BigDecimal price,
                            @NotEmpty(message = "La descrizione breve non può essere vuota")
                            @Size(max = 255, message = "La descrizione breve non può superare 255 caratteri")
                            String shortDescription,
                            @NotEmpty(message = "La descrizione non può essere vuota")
                            String description,
                            @NotNull(message = "Lo stock è obbligatorio")
                            @PositiveOrZero(message = "Lo stock deve essere un numero >= 0")
                            Integer stock,
                            @NotNull(message = "La categoria è obbligatoria")
                            UUID categoryId,
                            /** null = default true in persistenza */
                            Boolean active,
                            // nullable — URL immagini da rimuovere (cleanup lista; Cloudinary TODO)
                            List<String> removedImageUrls,
                            /** Badge attivi, es. ["new","sale"]. Valori ammessi: new, sale, promo, limited, bestseller, coming_soon */
                            List<String> badges
)
{}