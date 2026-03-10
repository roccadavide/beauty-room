package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.customerDTOs.CustomerDetailDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.customerDTOs.CustomerSummaryDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.customerDTOs.UpdateCustomerNotesDTO;
import daviderocca.CAPSTONE_BACKEND.services.CustomerService;
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
}