package daviderocca.CAPSTONE_BACKEND.DTO;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public record NewCategoryDTO (
                              @NotEmpty(message = "La chiave della categoria non può essere vuota")
                              @Size(max = 50, message = "La chiave della categoria non può superare i 50 caratteri")
                              String categoryKey,
                              @NotEmpty(message = "L'etichetta della categoria non può essere vuota")
                              @Size(max = 100, message = "L'etichetta della categoria non può superare i 100 caratteri")
                              String label
)
{}
