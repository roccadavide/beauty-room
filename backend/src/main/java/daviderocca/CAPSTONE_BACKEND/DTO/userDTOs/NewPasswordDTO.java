package daviderocca.CAPSTONE_BACKEND.DTO.userDTOs;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public record NewPasswordDTO(

        @NotEmpty(message = "La vecchia password è obbligatoria.")
        String oldPassword,

        @NotEmpty(message = "La nuova password è obbligatoria.")
        @Size(min = 6, message = "La nuova password deve contenere almeno 6 caratteri.")
        String newPassword,

        @NotEmpty(message = "La conferma della nuova password è obbligatoria.")
        String confirmNewPassword
) {}