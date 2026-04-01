package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.WaitlistEntry;
import daviderocca.beautyroom.enums.WaitlistStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WaitlistRepository extends JpaRepository<WaitlistEntry, UUID> {

    /** Prima persona in lista per questo slot esatto, ordinata per data iscrizione FIFO */
    Optional<WaitlistEntry> findFirstByServiceServiceIdAndRequestedDateAndRequestedTimeAndStatusOrderByCreatedAtAsc(
        UUID serviceId, LocalDate date, LocalTime time, WaitlistStatus status
    );

    /** Tutte le persone in lista per un dato slot (per admin) */
    List<WaitlistEntry> findByServiceServiceIdAndRequestedDateAndRequestedTimeOrderByCreatedAtAsc(
        UUID serviceId, LocalDate date, LocalTime time
    );

    /** Controlla se una email è già in lista per questo slot */
    boolean existsByServiceServiceIdAndRequestedDateAndRequestedTimeAndCustomerEmailIgnoreCaseAndStatusIn(
        UUID serviceId, LocalDate date, LocalTime time,
        String email, List<WaitlistStatus> statuses
    );

    /** Per lo scheduler di scadenza token */
    List<WaitlistEntry> findByStatusAndTokenExpiresAtBefore(
        WaitlistStatus status, LocalDateTime now
    );

    /** Recupero tramite token */
    Optional<WaitlistEntry> findByToken(String token);

    @EntityGraph(attributePaths = {"service"})
    Optional<WaitlistEntry> findById(UUID id);
}
