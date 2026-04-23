package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.services.AppSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AppSettingsController {

    private final AppSettingsService settingsService;

    /** Pubblico: ritorna il limite di cancellazione in ore. */
    @GetMapping("/settings/public/cancellation-policy")
    public ResponseEntity<Map<String, Integer>> getCancellationPolicy() {
        return ResponseEntity.ok(Map.of("cancellationHoursLimit", settingsService.getCancellationHoursLimit()));
    }

    /** Admin: aggiorna il limite di cancellazione. */
    @PatchMapping("/admin/settings/cancellation-hours-limit")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Integer>> setCancellationHoursLimit(@RequestBody Map<String, Integer> body) {
        Integer hours = body.get("cancellationHoursLimit");
        if (hours == null) {
            return ResponseEntity.badRequest().build();
        }
        settingsService.setCancellationHoursLimit(hours);
        return ResponseEntity.ok(Map.of("cancellationHoursLimit", hours));
    }
}
