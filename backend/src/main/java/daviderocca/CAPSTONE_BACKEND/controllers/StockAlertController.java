package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.services.StockAlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class StockAlertController {

    private final StockAlertService stockAlertService;

    /**
     * POST /products/{productId}/stock-alerts
     * Pubblico — non richiede autenticazione.
     * 201 Created on success, 409 Conflict se già iscritto.
     */
    @PostMapping("/{productId}/stock-alerts")
    public ResponseEntity<?> subscribe(
            @PathVariable UUID productId,
            @RequestBody Map<String, String> body
    ) {
        String email = body.get("email");
        String name  = body.get("customerName");

        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "Email obbligatoria."));
        }

        try {
            stockAlertService.subscribe(productId, email, name);
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Avviso registrato con successo."));
        } catch (StockAlertService.AlreadySubscribedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", e.getMessage()));
        }
    }
}
