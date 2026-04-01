package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.waitlistDTOs.WaitlistRequestDTO;
import daviderocca.beautyroom.DTO.waitlistDTOs.WaitlistResponseDTO;
import daviderocca.beautyroom.entities.WaitlistEntry;
import daviderocca.beautyroom.services.WaitlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/waitlist")
@RequiredArgsConstructor
public class WaitlistController {

    private final WaitlistService waitlistService;

    /** Iscrizione pubblica */
    @PostMapping
    public ResponseEntity<WaitlistResponseDTO> join(@RequestBody WaitlistRequestDTO req) {
        return ResponseEntity.ok(waitlistService.joinWaitlist(req));
    }

    /** Verifica token e restituisce i dati pre-compilati per il BookingModal */
    @GetMapping("/token/{token}")
    public ResponseEntity<Map<String, Object>> resolveToken(@PathVariable String token) {
        WaitlistEntry entry = waitlistService.consumeToken(token);
        return ResponseEntity.ok(Map.of(
            "serviceId",     entry.getService().getServiceId(),
            "requestedDate", entry.getRequestedDate().toString(),
            "requestedTime", entry.getRequestedTime().toString().substring(0, 5),
            "customerName",  entry.getCustomerName(),
            "customerEmail", entry.getCustomerEmail(),
            "customerPhone", entry.getCustomerPhone(),
            "waitlistId",    entry.getId()
        ));
    }
}
