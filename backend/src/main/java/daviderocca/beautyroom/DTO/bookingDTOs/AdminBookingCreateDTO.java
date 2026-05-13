package daviderocca.beautyroom.DTO.bookingDTOs;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Request DTO for the new multi-service admin booking endpoint.
 * Supports catalog services, custom (free-form) services, and package sessions —
 * all combinable in a single appointment.
 *
 * Validation rules (enforced in service layer):
 *   - At least one of: serviceIds non-empty, hasCustomService=true, packageAssignmentId non-null
 *   - If hasCustomService=true: customServiceName and customServiceDurationMinutes are required
 *   - date and startTime are always required
 */
public record AdminBookingCreateDTO(

        @NotBlank(message = "Nome cliente obbligatorio")
        @Size(max = 100)
        String customerName,

        @Size(max = 20)
        String customerPhone,

        @Size(max = 100)
        String customerEmail,

        // Catalog services — zero or more
        List<UUID> serviceIds,

        // Custom service
        Boolean hasCustomService,
        @Size(max = 255)
        String customServiceName,
        BigDecimal customServicePrice,
        Integer customServiceDurationMinutes,

        // Package session (links one session of an existing ClientPackageAssignment)
        UUID packageAssignmentId,

        // Package session (links one session of an online/Stripe-purchased PackageCredit)
        UUID packageCreditId,

        // Session tracking
        Integer currentSession,
        Integer totalSessions,

        // Scheduling — required
        @NotNull(message = "Data obbligatoria")
        LocalDate date,

        @NotNull(message = "Ora di inizio obbligatoria")
        LocalTime startTime,

        // Misc
        String notes,
        Integer paddingMinutes,
        boolean consentLaser,
        boolean consentPmu,
        UUID serviceOptionId,
        Boolean paidInStore,

        // Multi-service overrides (new — backwards compatible)
        Integer customTotalDurationMin
) {}
