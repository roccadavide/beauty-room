package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs.ClosureResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.closureDTOs.NewClosureDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Closure;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.ClosureRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ClosureService {

    private final ClosureRepository closureRepository;

    // -------------------------- FIND ALL --------------------------
    @Transactional(readOnly = true)
    public List<ClosureResponseDTO> findAllClosures() {
        return closureRepository.findAll().stream()
                .map(this::convertToDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ClosureResponseDTO> findClosuresInRange(LocalDate from, LocalDate toExclusive) {
        if (from == null || toExclusive == null) throw new BadRequestException("Range non valido.");
        if (!from.isBefore(toExclusive)) throw new BadRequestException("Range non valido (from < to).");

        return closureRepository.findByDateRange(from, toExclusive).stream()
                .map(this::convertToDTO)
                .toList();
    }

    // -------------------------- CREATE --------------------------
    @Transactional
    public ClosureResponseDTO createClosure(NewClosureDTO payload) {
        validateClosure(payload, null);

        Closure closure = new Closure(
                payload.date(),
                payload.startTime(),
                payload.endTime(),
                payload.reason()
        );

        Closure saved = closureRepository.save(closure);
        log.info("Nuova chiusura creata per il giorno {}", saved.getDate());
        return convertToDTO(saved);
    }

    // -------------------------- UPDATE --------------------------
    @Transactional
    public ClosureResponseDTO updateClosure(UUID id, NewClosureDTO payload) {
        Closure closure = closureRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Chiusura non trovata con id: " + id));

        validateClosure(payload, id);

        closure.setDate(payload.date());
        closure.setStartTime(payload.startTime());
        closure.setEndTime(payload.endTime());
        closure.setReason(payload.reason());

        Closure updated = closureRepository.save(closure);
        log.info("Chiusura {} aggiornata per la data {}", updated.getId(), updated.getDate());
        return convertToDTO(updated);
    }

    // -------------------------- DELETE --------------------------
    @Transactional
    public void deleteClosure(UUID id) {
        if (!closureRepository.existsById(id)) {
            throw new ResourceNotFoundException("Chiusura non trovata con id: " + id);
        }
        closureRepository.deleteById(id);
        log.info("Chiusura {} eliminata.", id);
    }

    // -------------------------- VALIDATION --------------------------
    private void validateClosure(NewClosureDTO payload, UUID excludeId) {
        if (payload == null) throw new BadRequestException("Payload mancante.");

        if (payload.date() == null) throw new BadRequestException("La data della chiusura è obbligatoria.");
        if (payload.date().isBefore(LocalDate.now())) {
            throw new BadRequestException("La data della chiusura non può essere nel passato.");
        }

        if (payload.reason() == null || payload.reason().trim().isEmpty()) {
            throw new BadRequestException("La motivazione della chiusura è obbligatoria.");
        }

        LocalTime start = payload.startTime();
        LocalTime end = payload.endTime();

        boolean fullDay = (start == null && end == null);

        // Se parziale, devono esserci entrambi
        if (!fullDay) {
            if (start == null || end == null) {
                throw new BadRequestException("Per una chiusura parziale devi specificare sia startTime che endTime.");
            }
            if (!start.isBefore(end)) {
                throw new BadRequestException("L'orario di inizio deve essere precedente a quello di fine.");
            }
        }

        // Carico le closures del giorno (escludendo se update)
        List<Closure> sameDay = (excludeId == null)
                ? closureRepository.findByDate(payload.date())
                : closureRepository.findByDateExcluding(payload.date(), excludeId);

        // Se esiste già una full-day, nessun’altra closure è ammessa
        if (sameDay.stream().anyMatch(Closure::isFullDay)) {
            throw new BadRequestException("Esiste già una chiusura di intera giornata per questa data.");
        }

        // Se la nuova è full-day, non devono esistere closures parziali
        if (fullDay && !sameDay.isEmpty()) {
            throw new BadRequestException("Non puoi impostare una chiusura giornaliera: esistono già chiusure parziali per questa data.");
        }

        // Overlap tra chiusure parziali
        if (!fullDay) {
            for (Closure c : sameDay) {
                if (c.isFullDay()) continue; // già gestito sopra
                if (overlaps(start, end, c.getStartTime(), c.getEndTime())) {
                    throw new BadRequestException("La chiusura si sovrappone a un'altra chiusura già presente in questa data.");
                }
            }
        }
    }

    private boolean overlaps(LocalTime aStart, LocalTime aEnd, LocalTime bStart, LocalTime bEnd) {
        // overlap su [start, end)
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }

    // ---------------------------- CONVERTER ----------------------------
    private ClosureResponseDTO convertToDTO(Closure closure) {
        return new ClosureResponseDTO(
                closure.getId(),
                closure.getDate(),
                closure.getStartTime(),
                closure.getEndTime(),
                closure.getReason(),
                closure.isFullDay(),
                closure.getCreatedAt()
        );
    }
}