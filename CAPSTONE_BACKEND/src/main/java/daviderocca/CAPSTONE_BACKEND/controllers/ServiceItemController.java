package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.ServiceItemResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewServiceItemDTO;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.ServiceItemService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/serviceItems")
@Slf4j
public class ServiceItemController {

    @Autowired
    private ServiceItemService serviceItemService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public Page<ServiceItemResponseDTO> getAllServiceItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "40") int size,
            @RequestParam(defaultValue = "title") String sort
    ) {
        log.info("Richiesta elenco servizi - pagina: {}, size: {}, sort: {}", page, size, sort);
        return serviceItemService.findAllServiceItems(page, size, sort);
    }

    @GetMapping("/{serviceItemId}")
    @ResponseStatus(HttpStatus.OK)
    public ServiceItemResponseDTO getServiceItemById(@PathVariable UUID serviceItemId) {
        log.info("Richiesta dettaglio servizio {}", serviceItemId);
        return serviceItemService.findServiceItemByIdAndConvert(serviceItemId);
    }

    // ---------------------------------- POST ----------------------------------

    @PostMapping("/postService")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ServiceItemResponseDTO createServiceItem(
            @RequestPart("data") @Validated NewServiceItemDTO payload,
            @RequestPart(value = "image", required = false) MultipartFile image,
            BindingResult bindingResult) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta creazione servizio {}", payload.title());
        return serviceItemService.saveServiceItem(payload, image);
    }

    // ---------------------------------- PUT ----------------------------------

    @PutMapping("/{serviceItemId}")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('ADMIN')")
    public ServiceItemResponseDTO updateServiceItem(
            @PathVariable UUID serviceItemId,
            @RequestPart("data") @Validated NewServiceItemDTO payload,
            @RequestPart(value = "image", required = false) MultipartFile image,
            BindingResult bindingResult
    ) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta aggiornamento servizio {}", serviceItemId);
        return serviceItemService.findServiceItemByIdAndUpdate(serviceItemId, payload, image);
    }

    // ---------------------------------- DELETE ----------------------------------

    @DeleteMapping("/{serviceItemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteServiceItem(@PathVariable UUID serviceItemId) {
        log.info("Richiesta eliminazione servizio {}", serviceItemId);
        serviceItemService.findServiceItemByIdAndDelete(serviceItemId);
    }

}
