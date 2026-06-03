package daviderocca.beautyroom.DTO.bookingDTOs;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Request DTO for the new multi-service admin booking endpoint.
 * Supports catalog services, custom (free-form) services, and package sessions —
 * all combinable in a single appointment.
 *
 * Validation rules (enforced in service layer):
 *   - At least one of: serviceIds non-empty, hasCustomService=true, packageAssignmentIds non-empty,
 *     packageAssignmentId non-null (deprecated)
 *   - If hasCustomService=true: customServiceName and customServiceDurationMinutes are required
 *   - date and startTime are always required
 *
 * Phase 5a: a single booking may now link N in-person packages at once via
 * {@code packageAssignmentIds}. The legacy singular {@code packageAssignmentId}
 * is honored only when {@code packageAssignmentIds} is null/empty.
 */
public record AdminBookingCreateDTO(

        @NotBlank(message = "Nome cliente obbligatorio")
        @Size(max = 100)
        String customerName,

        @Size(max = 20)
        String customerPhone,

        @Size(max = 100)
        String customerEmail,

        // Optional pre-resolved customer (inline "Salva cliente" in the drawer).
        // When present, the booking attaches to THIS customer and find-or-create
        // is skipped — closing the edge where the phone is edited after create.
        // Null → fall back to phone/email find-or-create, so an older frontend
        // that doesn't send it still works (deploy-order independent).
        UUID customerId,

        // Catalog services — zero or more
        List<UUID> serviceIds,

        // Custom service
        Boolean hasCustomService,
        @Size(max = 255)
        String customServiceName,
        BigDecimal customServicePrice,
        Integer customServiceDurationMinutes,

        // Package session (links one session of an existing ClientPackageAssignment).
        // Deprecated — kept for back-compat. New clients must use packageAssignmentIds.
        @Deprecated
        UUID packageAssignmentId,

        // Phase 5a: N in-person package links per booking.
        // When non-empty this takes precedence over packageAssignmentId.
        List<UUID> packageAssignmentIds,

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
        Integer customTotalDurationMin,

        // V64: custom total price for the whole appointment (bundle override).
        // Null = no override (per-line prices win). Purely manual — no auto-compute.
        BigDecimal customTotalPrice,

        // Per-service option mapping — replaces the flat serviceOptionId for multi-service bookings.
        // When present and non-empty, takes precedence over serviceIds + serviceOptionId.
        List<ServiceEntryDTO> serviceEntries,

        // V62: per-line paid flag for the custom (free-form) service line.
        // Null is treated as FALSE.
        Boolean customServicePaid,

        // V62: per-package paid map — keyed by ClientPackageAssignment.id.
        // For each linked in-person package, the boolean tells whether THIS session
        // is settled. Locked packages (assignment.paidUpfront = TRUE) are ignored:
        // the UI cannot edit them and the backend treats the upfront flag as
        // authoritative regardless of any value passed here.
        Map<UUID, Boolean> packageSessionPaid,

        // V65 (08.1): promotions to attach to this appointment (mirrors packageAssignmentIds).
        // Appended at the end so Jackson name-based deserialization stays safe.
        // Unused by BookingService until 08.2 — present only to grow the payload shape.
        List<UUID> promotionIds,

        // V65 (08.1): per-promotion paid toggle, keyed by promotionId (mirrors packageSessionPaid).
        Map<UUID, Boolean> promotionPaid
) {}
