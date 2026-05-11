package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.customerDTOs.CustomerDetailDTO;
import daviderocca.beautyroom.DTO.customerDTOs.CustomerSummaryDTO;
import daviderocca.beautyroom.DTO.customerDTOs.UpdateCustomerDTO;
import daviderocca.beautyroom.DTO.customerDTOs.UpdateCustomerNotesDTO;
import daviderocca.beautyroom.packages.ClientPackageAssignmentDTO;
import daviderocca.beautyroom.packages.ClientPackageService;
import daviderocca.beautyroom.services.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/customers")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class CustomerController {

    private final CustomerService customerService;
    private final ClientPackageService clientPackageService;

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
     * Returns active ClientPackageAssignments for the customer, looked up by full name.
     */
    @GetMapping("/{id}/active-packages")
    public ResponseEntity<List<ClientPackageAssignmentDTO>> activePackages(@PathVariable UUID id) {
        String fullName = customerService.getFullName(id);
        return ResponseEntity.ok(clientPackageService.findActiveByClientName(fullName));
    }
}