package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs.AvailabilityResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.availabilityDTOs.DayTimelineDTO;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.AvailabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/availabilities")
@RequiredArgsConstructor
@Slf4j
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    // CLIENT
    @GetMapping("/services/{serviceId}")
    public ResponseEntity<AvailabilityResponseDTO> getServiceDaySlots(
            @PathVariable UUID serviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        if (date == null) throw new BadRequestException("La data richiesta non può essere nulla.");
        if (date.isBefore(LocalDate.now())) throw new BadRequestException("Non è possibile richiedere disponibilità per date passate.");

        return ResponseEntity.ok(availabilityService.getServiceAvailabilities(serviceId, date));
    }

    // ADMIN - TIMELINE DAY
    @GetMapping("/admin/timeline/day")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DayTimelineDTO> getDayTimeline(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        if (date == null) throw new BadRequestException("La data richiesta non può essere nulla.");
        return ResponseEntity.ok(availabilityService.getDayTimeline(date));
    }
}