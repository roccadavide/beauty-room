package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.NewClosureDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Closure;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.ClosureRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class ClosureService {

    @Autowired
    private ClosureRepository closureRepository;

    public List<Closure> findAllClosure() {
        return closureRepository.findAll();
    }

    public Closure createClosure(NewClosureDTO payload) {

        if (payload.date().isBefore(LocalDate.now())) {
            throw new BadRequestException("La data della chiusura non può essere nel passato.");
        }

        if (payload.startTime() != null && payload.endTime() != null &&
                !payload.startTime().isBefore(payload.endTime())) {
            throw new BadRequestException("L'orario di inizio deve essere precedente a quello di fine.");
        }

        Closure closure = new Closure();
        closure.setDate(payload.date());
        closure.setStartTime(payload.startTime());
        closure.setEndTime(payload.endTime());
        closure.setReason(payload.reason());

        return closureRepository.save(closure);
    }

    public Closure updateClosure(UUID id, NewClosureDTO payload) {
        Closure closure = closureRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Chiusura non trovata con id: " + id));

        if (payload.date().isBefore(LocalDate.now())) {
            throw new BadRequestException("La data della chiusura non può essere nel passato.");
        }

        if (payload.startTime() != null && payload.endTime() != null &&
                !payload.startTime().isBefore(payload.endTime())) {
            throw new BadRequestException("L'orario di inizio deve essere precedente a quello di fine.");
        }

        closure.setDate(payload.date());
        closure.setStartTime(payload.startTime());
        closure.setEndTime(payload.endTime());
        closure.setReason(payload.reason());

        return closureRepository.save(closure);
    }

    public void deleteClosure(UUID id) {
        if (!closureRepository.existsById(id)) {
            throw new ResourceNotFoundException("Chiusura non trovata con id: " + id);
        }
        closureRepository.deleteById(id);
    }
}