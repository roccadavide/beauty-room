package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs.AvailabilityResponseDTO;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.AvailabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/availabilities")
@RequiredArgsConstructor
@Slf4j
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    // ---------------------------------- GET ----------------------------------

    @GetMapping("/services/{serviceId}")
    public ResponseEntity<AvailabilityResponseDTO> getServiceDaySlots(
            @PathVariable UUID serviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        log.info("Richiesta disponibilità per il servizio {} nella data {}", serviceId, date);

        if (date == null) {
            throw new BadRequestException("La data richiesta non può essere nulla.");
        }

        if (date.isBefore(LocalDate.now())) {
            throw new BadRequestException("Non è possibile richiedere disponibilità per date passate.");
        }

        AvailabilityResponseDTO response = availabilityService.getServiceAvailabilities(serviceId, date);
        log.info("Disponibilità trovate per il servizio {} nella data {}: {}", serviceId, date, response);
        return ResponseEntity.ok(response);
    }
}