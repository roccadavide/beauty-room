package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.customerDTOs.CustomerDetailDTO;
import daviderocca.beautyroom.DTO.customerDTOs.CustomerSummaryDTO;
import daviderocca.beautyroom.DTO.customerDTOs.UpdateCustomerDTO;
import daviderocca.beautyroom.DTO.customerDTOs.UpdateCustomerNotesDTO;
import daviderocca.beautyroom.DTO.packageDTOs.UnifiedActivePackageDTO;
import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.packages.ClientPackageService;
import daviderocca.beautyroom.services.CustomerService;
import daviderocca.beautyroom.services.PackageCreditService;
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
@PreAuthorize("hasRole('ADMIN')")
public class CustomerController {

    private final CustomerService customerService;
    private final ClientPackageService clientPackageService;
    private final PackageCreditService packageCreditService;

    @GetMapping("/search")
    public ResponseEntity<List<CustomerSummaryDTO>> search(
        @RequestParam(defaultValue = "") String q
    ) {
        return ResponseEntity.ok(customerService.search(q));
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<CustomerDetailDTO> summary(@PathVariable UUID id) {
        return ResponseEntity.ok(customerService.getSummary(id));
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
        String email    = customerService.getEmail(id);

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
                a.linkedUserId()
            ))
        );

        // ONLINE packages (Stripe-purchased PackageCredit)
        if (email != null && !email.isBlank()) {
            for (PackageCredit pc : packageCreditService.findActiveByEmail(email)) {
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
                    null, null, null, null, null
                ));
            }
        }

        return ResponseEntity.ok(result);
    }

    /**
     * DELETE /admin/customers/{id}
     * Deletes a customer. Returns 409 if they have active bookings or packages.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCustomer(@PathVariable UUID id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.noContent().build();
    }
}