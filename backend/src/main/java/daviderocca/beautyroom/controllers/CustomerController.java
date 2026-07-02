package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.customerDTOs.CreateCustomerDTO;
import daviderocca.beautyroom.DTO.customerDTOs.CustomerBookingsDTO;
import daviderocca.beautyroom.DTO.customerDTOs.CustomerDetailDTO;
import daviderocca.beautyroom.DTO.customerDTOs.CustomerInsightsDTO;
import daviderocca.beautyroom.DTO.customerDTOs.CustomerSummaryDTO;
import daviderocca.beautyroom.DTO.customerDTOs.UpdateCustomerDTO;
import daviderocca.beautyroom.DTO.customerDTOs.UpdateCustomerNotesDTO;
import daviderocca.beautyroom.DTO.packageDTOs.UnifiedActivePackageDTO;
import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.packages.ClientPackageService;
import daviderocca.beautyroom.services.BookingService;
import daviderocca.beautyroom.services.CustomerInsightsService;
import daviderocca.beautyroom.services.CustomerService;
import daviderocca.beautyroom.services.PackageCreditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/customers")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','STAFF')")
public class CustomerController {

    private final CustomerService customerService;
    private final ClientPackageService clientPackageService;
    private final PackageCreditService packageCreditService;
    // Rich booking history is assembled by BookingService (it owns assembleBookingCard); injecting
    // it here — not into CustomerService — avoids the BookingService↔CustomerService cycle.
    private final BookingService bookingService;
    private final CustomerInsightsService customerInsightsService;

    @GetMapping("/search")
    public ResponseEntity<List<CustomerSummaryDTO>> search(
        @RequestParam(defaultValue = "") String q
    ) {
        return ResponseEntity.ok(customerService.search(q));
    }

    /**
     * POST /admin/customers
     * Inline customer creation from the Admin Agenda drawer. Find-or-create
     * keyed on phone (see CustomerService#create), so it is idempotent for an
     * already-known phone and never conflicts with the booking-create path.
     */
    @PostMapping
    public ResponseEntity<CustomerSummaryDTO> create(@Valid @RequestBody CreateCustomerDTO payload) {
        CustomerSummaryDTO created = customerService.create(payload);
        return ResponseEntity
                .created(java.net.URI.create("/admin/customers/" + created.customerId()))
                .body(created);
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<CustomerDetailDTO> summary(@PathVariable UUID id) {
        return ResponseEntity.ok(customerService.getSummary(id));
    }

    /**
     * GET /admin/customers/{id}/bookings?pastLimit=20&pastOffset=0
     * Rich per-customer booking history. Each row is a full AdminBookingCardDTO (same assembler the
     * agenda uses), split into {@code upcoming} (active future, soonest first, all) and {@code past}
     * (everything else, newest first, paginated) plus {@code pastTotal} for "load more". Matching is
     * customer FK OR normalized phone, so legacy / FK-null rows are still found.
     */
    @GetMapping("/{id}/bookings")
    public ResponseEntity<CustomerBookingsDTO> customerBookings(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "20") int pastLimit,
            @RequestParam(defaultValue = "0") int pastOffset
    ) {
        return ResponseEntity.ok(bookingService.getCustomerBookingCards(id, pastLimit, pastOffset));
    }

    /**
     * GET /admin/customers/insights
     * Customers-workspace overview dashboard: headline counts, top clients by completed
     * appointments / packages / all-time spend, and a win-back list. Pure read, aggregate only.
     */
    @GetMapping("/insights")
    public ResponseEntity<CustomerInsightsDTO> insights() {
        return ResponseEntity.ok(customerInsightsService.getInsights());
    }

    @PatchMapping("/{id}/notes")
    public ResponseEntity<Void> updateNotes(
            @PathVariable UUID id,
            @RequestBody UpdateCustomerNotesDTO payload
    ) {
        customerService.updateNotes(id, payload.notes());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}")
    public ResponseEntity<CustomerSummaryDTO> updateCustomer(
            @PathVariable UUID id,
            @RequestBody UpdateCustomerDTO payload
    ) {
        return ResponseEntity.ok(customerService.updateCustomer(id, payload));
    }

    /**
     * GET /admin/customers/{id}/active-packages
     * Returns active packages for the customer — both admin-assigned (ClientPackageAssignment)
     * and online-purchased (PackageCredit) — as a unified list.
     */
    @GetMapping("/{id}/active-packages")
    public ResponseEntity<List<UnifiedActivePackageDTO>> activePackages(@PathVariable UUID id) {
        String fullName = customerService.getFullName(id);

        List<UnifiedActivePackageDTO> result = new ArrayList<>();

        // ADMIN-assigned packages
        clientPackageService.findActiveByClientName(fullName).forEach(a ->
            result.add(new UnifiedActivePackageDTO(
                a.id(),
                a.displayName(),
                a.serviceTitle(),
                a.serviceOptionId(),
                a.totalSessions(),
                a.sessionsRemaining(),
                a.sessionDurationMin(),
                a.status().name(),
                "ADMIN",
                a.clientName(),
                a.customPackageName(),
                a.pricePaid(),
                a.notes(),
                a.linkedUserId(),
                a.paidUpfront(),
                null   // ADMIN packages: no expiry surfaced on this card
            ))
        );

        // ONLINE packages (Stripe-purchased PackageCredit) — resolved through the customer's OWN
        // bookings (FK bridge), NOT by email. The purchase webhook links booking.customer and
        // booking.packageCredit, so this returns only THIS customer's credits: collision-free
        // (no shared-email leakage between two customers) and immune to a stale/blank Customer.email
        // left by the phone-first find-or-create. Always paid upfront (prepaid via Stripe).
        for (PackageCredit pc : packageCreditService.findActiveByCustomerId(id)) {
            String displayName = pc.getServiceOption() != null
                    ? pc.getServiceOption().getName()
                    : (pc.getService() != null ? pc.getService().getTitle() : "Pacchetto online");
            String serviceTitle = pc.getService() != null ? pc.getService().getTitle() : null;
            result.add(new UnifiedActivePackageDTO(
                pc.getPackageCreditId(),
                displayName,
                serviceTitle,
                pc.getServiceOption() != null ? pc.getServiceOption().getOptionId() : null,
                pc.getSessionsTotal(),
                pc.getSessionsRemaining(),
                null,
                pc.getStatus().name(),
                "ONLINE",
                null, null, null, null, null,
                true,
                pc.getExpiryDate()
            ));
        }

        return ResponseEntity.ok(result);
    }

    /**
     * DELETE /admin/customers/{id}
     * Deletes a customer. Returns 409 if they have active bookings or packages.
     * Destructive and not in matrix row 12 — fail-closed: owner-only override.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteCustomer(@PathVariable UUID id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.noContent().build();
    }
}