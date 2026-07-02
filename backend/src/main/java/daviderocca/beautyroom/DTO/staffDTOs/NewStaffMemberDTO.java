package daviderocca.beautyroom.DTO.staffDTOs;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * POST /admin/staff payload: creates the login User (role STAFF, verified)
 * and the linked staff_members row in one transaction.
 */
public record NewStaffMemberDTO(
        @NotBlank(message = "Il nome visualizzato è obbligatorio")
        @Size(min = 2, max = 80, message = "Il nome visualizzato deve avere tra 2 e 80 caratteri")
        String displayName,

        @NotEmpty(message = "Email obbligatoria")
        @Email(message = "Email non valida")
        String email,

        @NotEmpty(message = "Password obbligatoria")
        @Size(min = 6, message = "La password deve avere almeno 6 caratteri")
        String password,

        @NotEmpty(message = "Il numero di telefono è obbligatorio")
        @Pattern(regexp = "\\+?[0-9]{7,15}", message = "Telefono non valido")
        String phone,

        // nullable — agenda accent
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Colore non valido: usare il formato #RRGGBB")
        String color
) {}
