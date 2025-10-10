package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.ClosureResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewClosureDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Closure;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.ClosureRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class ClosureService {

    @Autowired
    private ClosureRepository closureRepository;

    // -------------------------- FIND ALL --------------------------
    @Transactional(readOnly = true)
    public List<ClosureResponseDTO> findAllClosures() {
        return closureRepository.findAll().stream()
                .map(this::convertToDTO)
                .toList();
    }

    // -------------------------- CREATE --------------------------
    @Transactional
    public ClosureResponseDTO createClosure(NewClosureDTO payload) {
        validateClosure(payload);
        Closure closure = new Closure(payload.date(), payload.startTime(), payload.endTime(), payload.reason());
        Closure saved = closureRepository.save(closure);
        log.info("Nuova chiusura creata per il giorno {}", saved.getDate());
        return convertToDTO(saved);
    }

    // -------------------------- UPDATE --------------------------
    @Transactional
    public ClosureResponseDTO updateClosure(UUID id, NewClosureDTO payload) {
        Closure closure = closureRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Chiusura non trovata con id: " + id));

        validateClosure(payload);

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

    // -------------------------- HELPERS --------------------------
    private void validateClosure(NewClosureDTO payload) {
        if (payload.date().isBefore(LocalDate.now())) {
            throw new BadRequestException("La data della chiusura non può essere nel passato.");
        }

        if (payload.startTime() != null && payload.endTime() != null &&
                !payload.startTime().isBefore(payload.endTime())) {
            throw new BadRequestException("L'orario di inizio deve essere precedente a quello di fine.");
        }
    }

    // ---------------------------- CONVERTER ----------------------------
    private ClosureResponseDTO convertToDTO(Closure c) {
        return new ClosureResponseDTO(
                c.getId(),
                c.getDate(),
                c.getStartTime(),
                c.getEndTime(),
                c.getReason(),
                c.isFullDay(),
                c.getCreatedAt()
        );
    }
}