package daviderocca.CAPSTONE_BACKEND.DTO;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record NewResultDTO(
        @NotEmpty(message = "Il titolo è obbligatorio")
        @Size(min = 3, max = 100, message = "Il titolo deve avere tra 3 e 100 caratteri")
        String title,
        @NotEmpty(message = "La descrizione breve non può essere vuota")
        @Size(max = 200, message = "La descrizione breve non può superare i 200 caratteri")
        String shortDescription,
        @NotEmpty(message = "La descrizione  non può essere vuota")
        String description,
        @NotNull(message = "La categoria è obbligatoria")
        UUID categoryId
) {}