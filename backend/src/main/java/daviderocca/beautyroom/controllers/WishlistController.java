package daviderocca.beautyroom.controllers;

import daviderocca.beautyroom.DTO.wishlistDTOs.*;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.WishlistItemType;
import daviderocca.beautyroom.services.WishlistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    /** Toggle wishlist: aggiunge o rimuove l'item. */
    @PostMapping("/toggle")
    public ResponseEntity<ToggleWishlistResponse> toggle(
            @Valid @RequestBody ToggleWishlistRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        ToggleWishlistResponse response = wishlistService.toggleWishlist(
                currentUser.getUserId(), request.itemType(), request.itemId()
        );
        return ResponseEntity.ok(response);
    }

    /** Restituisce la wishlist completa dell'utente autenticato. */
    @GetMapping
    public ResponseEntity<WishlistResponseDTO> getMyWishlist(
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(wishlistService.getWishlistForUser(currentUser.getUserId()));
    }

    /** Controlla se un singolo item è nella wishlist. */
    @GetMapping("/check")
    public ResponseEntity<ToggleWishlistResponse> check(
            @RequestParam WishlistItemType itemType,
            @RequestParam UUID itemId,
            @AuthenticationPrincipal User currentUser
    ) {
        boolean wishlisted = wishlistService.isWishlisted(currentUser.getUserId(), itemType, itemId);
        return ResponseEntity.ok(new ToggleWishlistResponse(wishlisted, null));
    }

    /** Statistiche wishlist — solo admin. */
    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<WishlistStatDTO>> getStats() {
        return ResponseEntity.ok(wishlistService.getWishlistStats());
    }
}
