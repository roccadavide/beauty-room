package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.AvailabilityResponseDTO;
import daviderocca.CAPSTONE_BACKEND.services.AvailabilityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/availabilities")
@Slf4j
public class AvailabilityController {

    @Autowired
    private AvailabilityService availabilityService;

    @GetMapping("/services/{serviceId}")
    public AvailabilityResponseDTO getServiceDaySlots(
            @PathVariable UUID serviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        log.info("Richiesta disponibilità per serviceId {} in data {}", serviceId, date);
        return availabilityService.getServiceAvailabilities(serviceId, date);
    }
}