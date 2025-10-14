package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs.NewServiceItemDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.serviceItemDTOs.ServiceItemResponseDTO;
import daviderocca.CAPSTONE_BACKEND.services.ServiceItemService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import java.util.UUID;

@RestController
@RequestMapping("/service-items")
@RequiredArgsConstructor
@Slf4j
public class ServiceItemController {

    private final ServiceItemService serviceItemService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping
    public ResponseEntity<Page<ServiceItemResponseDTO>> getAllServiceItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "40") int size,
            @RequestParam(defaultValue = "title") String sort
    ) {
        log.info("Richiesta elenco servizi [page={}, size={}, sort={}]", page, size, sort);
        Page<ServiceItemResponseDTO> services = serviceItemService.findAllServiceItems(page, size, sort);
        return ResponseEntity.ok(services);
    }

    @GetMapping("/{serviceItemId}")
    public ResponseEntity<ServiceItemResponseDTO> getServiceItemById(@PathVariable UUID serviceItemId) {
        log.info("Richiesta dettaglio servizio {}", serviceItemId);
        return ResponseEntity.ok(serviceItemService.findServiceItemByIdAndConvert(serviceItemId));
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ServiceItemResponseDTO> createServiceItem(
            @Valid @RequestPart("data") NewServiceItemDTO payload,
            @RequestPart(value = "image", required = false) MultipartFile image
    ) {
        log.info("Richiesta creazione servizio '{}'", payload.title());
        ServiceItemResponseDTO created = serviceItemService.saveServiceItem(payload, image);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{serviceItemId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ServiceItemResponseDTO> updateServiceItem(
            @PathVariable UUID serviceItemId,
            @Valid @RequestPart("data") NewServiceItemDTO payload,
            @RequestPart(value = "image", required = false) MultipartFile image
    ) {
        log.info("Richiesta aggiornamento servizio {}", serviceItemId);
        ServiceItemResponseDTO updated = serviceItemService.updateServiceItem(serviceItemId, payload, image);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{serviceItemId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteServiceItem(@PathVariable UUID serviceItemId) {
        log.info("Richiesta eliminazione servizio {}", serviceItemId);
        serviceItemService.deleteServiceItem(serviceItemId);
        return ResponseEntity.noContent().build();
    }
}