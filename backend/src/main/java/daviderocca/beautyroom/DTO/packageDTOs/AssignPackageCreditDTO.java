package daviderocca.beautyroom.DTO.packageDTOs;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AssignPackageCreditDTO(
        @NotBlank @Email
        String customerEmail,

        @NotNull
        UUID serviceOptionId,

        @Min(2)
        int sessionsTotal
) {}
