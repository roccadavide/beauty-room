package daviderocca.beautyroom.DTO.staffDTOs;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** PUT /admin/staff/{id} payload. */
public record UpdateStaffMemberDTO(
        @NotBlank(message = "Il nome visualizzato è obbligatorio")
        @Size(min = 2, max = 80, message = "Il nome visualizzato deve avere tra 2 e 80 caratteri")
        String displayName,

        // nullable — agenda accent
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Colore non valido: usare il formato #RRGGBB")
        String color,

        @NotNull(message = "L'ordinamento è obbligatorio")
        @Min(value = 0, message = "L'ordinamento non può essere negativo")
        Integer sortOrder
) {}
