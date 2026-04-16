package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.serviceItemDTOs.NewServiceItemDTO;
import daviderocca.beautyroom.DTO.serviceItemDTOs.PackageResponseDTO;
import daviderocca.beautyroom.DTO.serviceItemDTOs.ServiceItemResponseDTO;
import daviderocca.beautyroom.DTO.serviceItemDTOs.ServiceOptionRequestDTO;
import daviderocca.beautyroom.DTO.serviceItemDTOs.ServiceOptionResponseDTO;
import daviderocca.beautyroom.services.ServiceItemService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/service-items")
@RequiredArgsConstructor
@Slf4j
public class ServiceItemController {

    private final ServiceItemService serviceItemService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping("/options/packages")
    public ResponseEntity<List<PackageResponseDTO>> getActivePackages() {
        log.info("Richiesta pacchetti (ServiceOption con sessions > 1)");
        return ResponseEntity.ok(serviceItemService.getActivePackages());
    }

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
            @RequestPart(value = "images", required = false) List<MultipartFile> images
    ) {
        log.info("Richiesta creazione servizio '{}'", payload.title());
        ServiceItemResponseDTO created = serviceItemService.saveServiceItem(payload, images);
        return ResponseEntity.status(201).body(created);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{serviceItemId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ServiceItemResponseDTO> updateServiceItem(
            @PathVariable UUID serviceItemId,
            @Valid @RequestPart("data") NewServiceItemDTO payload,
            @RequestPart(value = "images", required = false) List<MultipartFile> images
    ) {
        log.info("Richiesta aggiornamento servizio {}", serviceItemId);
        ServiceItemResponseDTO updated = serviceItemService.updateServiceItem(serviceItemId, payload, images);
        return ResponseEntity.ok(updated);
    }

    // ---------------------------------- OPTIONS CRUD ----------------------------------

    @PostMapping("/{serviceId}/options")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ServiceOptionResponseDTO> createOption(
            @PathVariable UUID serviceId,
            @Valid @RequestBody ServiceOptionRequestDTO dto) {
        return ResponseEntity.status(201).body(serviceItemService.createOption(serviceId, dto));
    }

    @PutMapping("/options/{optionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ServiceOptionResponseDTO> updateOption(
            @PathVariable UUID optionId,
            @Valid @RequestBody ServiceOptionRequestDTO dto) {
        return ResponseEntity.ok(serviceItemService.updateOption(optionId, dto));
    }

    @DeleteMapping("/options/{optionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteOption(@PathVariable UUID optionId) {
        serviceItemService.deleteOption(optionId);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{serviceItemId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteServiceItem(@PathVariable UUID serviceItemId) {
        log.info("Richiesta eliminazione servizio {}", serviceItemId);
        serviceItemService.deleteServiceItem(serviceItemId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{serviceItemId}/featured")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ServiceItemResponseDTO> setFeatured(
            @PathVariable UUID serviceItemId,
            @RequestParam boolean value) {
        return ResponseEntity.ok(serviceItemService.setFeatured(serviceItemId, value));
    }

    @PatchMapping("/{serviceItemId}/toggle-active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> toggleActive(@PathVariable UUID serviceItemId) {
        serviceItemService.toggleActive(serviceItemId);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/options/{optionId}/toggle-active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> toggleOptionActive(@PathVariable UUID optionId) {
        serviceItemService.toggleOptionActive(optionId);
        return ResponseEntity.ok().build();
    }
}