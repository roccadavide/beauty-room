package daviderocca.beautyroom.DTO.userDTOs;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UserLoginDTO(
        @NotEmpty(message = "L'indirizzo email è obbligatorio")
        @Email(message = "L'indirizzo email inserito non è nel formato giusto")
        String email,
        @NotEmpty(message = "La password è obbligatoria")
        @Size(min = 6, message = "La password deve avere almeno 6 caratteri")
        String password,
        // Object (nullable) on purpose: an absent/null flag from any caller is treated as the
        // default (true), preserving the current always-persistent login — not as false.
        Boolean rememberMe
) {}
