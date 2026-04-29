package daviderocca.beautyroom.personalappointments;

import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PersonalAppointmentService {

    private final PersonalAppointmentRepository repo;

    @Transactional
    public PersonalAppointmentDTO create(PersonalAppointmentRequestDTO req) {
        PersonalAppointment entity = new PersonalAppointment();
        apply(entity, req);
        return toDTO(repo.save(entity));
    }

    @Transactional
    public PersonalAppointmentDTO update(UUID id, PersonalAppointmentRequestDTO req) {
        PersonalAppointment entity = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Appuntamento personale non trovato: " + id));
        apply(entity, req);
        return toDTO(repo.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repo.existsById(id)) {
            throw new ResourceNotFoundException("Appuntamento personale non trovato: " + id);
        }
        repo.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<PersonalAppointmentDTO> findByDate(LocalDate date) {
        return repo.findByAppointmentDateOrderByStartTime(date)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PersonalAppointmentDTO> findByWeek(LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        return repo.findByAppointmentDateBetweenOrderByAppointmentDateAscStartTimeAsc(weekStart, weekEnd)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void apply(PersonalAppointment entity, PersonalAppointmentRequestDTO req) {
        entity.setTitle(req.title().trim());
        entity.setNotes(req.notes() != null ? req.notes().trim() : null);
        entity.setAppointmentDate(req.appointmentDate());
        entity.setStartTime(req.startTime());
        entity.setDurationMinutes(req.durationMinutes());
    }

    PersonalAppointmentDTO toDTO(PersonalAppointment e) {
        return new PersonalAppointmentDTO(
                e.getId(),
                e.getTitle(),
                e.getNotes(),
                e.getAppointmentDate(),
                e.getStartTime(),
                e.getDurationMinutes(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
