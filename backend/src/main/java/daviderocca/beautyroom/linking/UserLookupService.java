package daviderocca.beautyroom.linking;

import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.LinkingStatus;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Attempts to match a booking/assignment client name to a registered User account.
 * The lookup is case-insensitive and matches against the full name (name + surname).
 * Always returns a result — never throws.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserLookupService {

    private final UserRepository userRepository;

    /**
     * Finds a User by ID or throws ResourceNotFoundException.
     */
    @Transactional(readOnly = true)
    public User findById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    /**
     * Tries to find a unique User whose full name matches {@code clientName}.
     *
     * @param clientName the raw name from the booking / assignment (e.g. "Giulia Rossi")
     * @return {@link LinkingOutcome} with status LINKED, UNMATCHED, or AMBIGUOUS
     */
    @Transactional(readOnly = true)
    public LinkingOutcome tryLink(String clientName) {
        if (clientName == null || clientName.isBlank()) {
            log.debug("tryLink called with blank name — UNMATCHED");
            return LinkingOutcome.unmatched();
        }

        String normalized = clientName.trim().toLowerCase();

        List<User> matches = userRepository.findAllByFullNameIgnoreCase(normalized);

        if (matches.isEmpty()) {
            log.debug("tryLink '{}' — UNMATCHED", normalized);
            return LinkingOutcome.unmatched();
        }

        if (matches.size() == 1) {
            User user = matches.get(0);
            log.debug("tryLink '{}' — LINKED to userId={}", normalized, user.getUserId());
            return LinkingOutcome.linked(user);
        }

        // Two or more users share the same full name
        log.warn("tryLink '{}' — AMBIGUOUS ({} accounts)", normalized, matches.size());
        return LinkingOutcome.ambiguous();
    }
}
