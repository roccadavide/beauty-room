package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.availabilityDTOs.AvailabilityResponseDTO;
import daviderocca.beautyroom.DTO.availabilityDTOs.DayTimelineDTO;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.services.AvailabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/availabilities")
@RequiredArgsConstructor
@Slf4j
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    @Value("${app.booking.max-advance-days:150}")
    private int maxAdvanceDays;

    // ENDPOINT PUBBLICO SLOT — GET /availabilities/services/{serviceId}?date={yyyy-MM-dd}
    // Restituisce tutti gli slot del giorno per il servizio, con available=true/false.
    // Whitelist: /availabilities/services/** in SecConfig.
    @GetMapping("/services/{serviceId}")
    public ResponseEntity<AvailabilityResponseDTO> getServiceDaySlots(
            @PathVariable UUID serviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        if (date == null) throw new BadRequestException("La data richiesta non può essere nulla.");
        if (date.isBefore(LocalDate.now(AvailabilityService.BUSINESS_ZONE)))
            throw new BadRequestException("Non è possibile richiedere disponibilità per date passate.");
        if (date.isAfter(LocalDate.now(AvailabilityService.BUSINESS_ZONE).plusDays(maxAdvanceDays)))
            throw new BadRequestException("Non è possibile prenotare con più di " + maxAdvanceDays + " giorni di anticipo.");

        return ResponseEntity.ok(availabilityService.getServiceAvailabilities(serviceId, date));
    }

    // PUBLIC — available slots for a given date + total duration
    // Used by the public multi-service booking modal.
    // Whitelisted in SecConfig alongside /availabilities/services/**
    @GetMapping("/available-slots")
    public ResponseEntity<List<String>> getAvailableSlots(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam int durationMinutes
    ) {
        if (date == null) throw new BadRequestException("La data richiesta non può essere nulla.");
        if (date.isBefore(LocalDate.now(AvailabilityService.BUSINESS_ZONE)))
            throw new BadRequestException("Non è possibile richiedere disponibilità per date passate.");
        if (date.isAfter(LocalDate.now(AvailabilityService.BUSINESS_ZONE).plusDays(maxAdvanceDays)))
            throw new BadRequestException("Non è possibile prenotare con più di " + maxAdvanceDays + " giorni di anticipo.");
        return ResponseEntity.ok(availabilityService.getAvailableSlots(date, durationMinutes));
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