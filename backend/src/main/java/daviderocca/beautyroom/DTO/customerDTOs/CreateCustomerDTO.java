package daviderocca.beautyroom.DTO.customerDTOs;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for POST /admin/customers (inline customer creation from the
 * Admin Agenda drawer).
 *
 * Phone is mandatory: it is the deduplication key used by
 * {@link daviderocca.beautyroom.services.CustomerService#findOrCreate} and is
 * backed by the partial unique index {@code ux_customer_phone}. Requiring it
 * here guarantees the inline-created record resolves to the same customer the
 * booking-create path would find or create.
 *
 * Email is optional: for walk-in clients the frontend sends a generated
 * technical address ({@code walkin+<stamp>@beautyroom.local}); {@code @Email}
 * only validates non-blank values, so that passes.
 */
public record CreateCustomerDTO(

        @NotBlank(message = "Nome cliente obbligatorio")
        @Size(max = 255)
        String fullName,

        @NotBlank(message = "Telefono obbligatorio")
        @Size(max = 50)
        String phone,

        @Email(message = "Email non valida")
        @Size(max = 255)
        String email
) {}
