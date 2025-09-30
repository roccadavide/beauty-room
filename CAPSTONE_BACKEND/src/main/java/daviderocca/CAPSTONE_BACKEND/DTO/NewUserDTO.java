package daviderocca.CAPSTONE_BACKEND.DTO;

import daviderocca.CAPSTONE_BACKEND.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record NewUserDTO(
                         @NotEmpty(message = "Il nome è obbligatorio")
                         @Size(min = 2, max = 30, message = "Il nome deve avere tra 2 e 30 caratteri")
                         String name,
                         @NotEmpty(message = "Il cognome è obbligatorio")
                         @Size(min = 2, max = 30, message = "Il cognome deve avere tra 2 e 30 caratteri")
                         String surname,
                         @NotEmpty(message = "Email obbligatoria")
                         @Email(message = "Email non valida")
                         String email,
                         @NotEmpty(message = "Password obbligatoria")
                         @Size(min = 6, message = "La password deve avere almeno 6 caratteri")
                         String password,
                         @NotEmpty(message = "Il numero di telefono è obbligatorio")
                         @Pattern(regexp = "\\+?[0-9]{7,15}", message = "Telefono non valido")
                         String phone
)
{}
