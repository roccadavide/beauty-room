package daviderocca.CAPSTONE_BACKEND.DTO;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Min;

import java.math.BigDecimal;
import java.util.UUID;

public record NewServiceItemDTO(
                                @NotEmpty(message = "Il titolo non può essere vuoto")
                                String title,
                                @Positive(message = "La durata deve essere un numero positivo")
                                @Min(value = 1, message = "La durata deve essere almeno di 1 minuto")
                                int durationMin,
                                @NotNull(message = "Il prezzo è obbligatorio")
                                @Positive(message = "Il prezzo deve essere maggiore di zero")
                                BigDecimal price,
                                @NotEmpty(message = "La descrizione breve non può essere vuota")
                                String shortDescription,
                                @NotEmpty(message = "La descrizione non può essere vuota")
                                String description,
                                @NotNull(message = "La categoria è obbligatoria")
                                UUID categoryId
) {}