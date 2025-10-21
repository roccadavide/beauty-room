package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.workingHoursDTOs.NewWorkingHoursDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.workingHoursDTOs.WorkingHoursResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.WorkingHours;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.WorkingHoursRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class WorkingHoursService {

    private final WorkingHoursRepository workingHoursRepository;

    // ---------------------------- FIND METHODS ----------------------------

    @Transactional(readOnly = true)
    public List<WorkingHoursResponseDTO> findAll() {
        return workingHoursRepository.findAll().stream()
                .map(this::convertToDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkingHours findById(UUID id) {
        return workingHoursRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Orario non trovato con id: " + id));
    }

    @Transactional(readOnly = true)
    public WorkingHoursResponseDTO findByIdAndConvert(UUID id) {
        return convertToDTO(findById(id));
    }

    @Transactional(readOnly = true)
    public WorkingHoursResponseDTO findByDayOfWeek(DayOfWeek day) {
        WorkingHours found = workingHoursRepository.findByDayOfWeek(day)
                .orElseThrow(() -> new ResourceNotFoundException("Orari non configurati per: " + day));
        return convertToDTO(found);
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public WorkingHoursResponseDTO createWorkingHours(NewWorkingHoursDTO payload) {
        validatePayload(payload);

        WorkingHours workingHours = new WorkingHours();
        workingHours.setDayOfWeek(payload.dayOfWeek());
        workingHours.setClosed(payload.closed());
        workingHours.setMorningStart(payload.morningStart());
        workingHours.setMorningEnd(payload.morningEnd());
        workingHours.setAfternoonStart(payload.afternoonStart());
        workingHours.setAfternoonEnd(payload.afternoonEnd());

        WorkingHours saved = workingHoursRepository.save(workingHours);
        log.info("Orario creato per il giorno {}", saved.getDayOfWeek());
        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE ----------------------------

    @Transactional
    public WorkingHoursResponseDTO updateWorkingHours(UUID id, NewWorkingHoursDTO payload) {
        validatePayload(payload);

        WorkingHours workingHours = findById(id);
        workingHours.setDayOfWeek(payload.dayOfWeek());
        workingHours.setClosed(payload.closed());
        workingHours.setMorningStart(payload.morningStart());
        workingHours.setMorningEnd(payload.morningEnd());
        workingHours.setAfternoonStart(payload.afternoonStart());
        workingHours.setAfternoonEnd(payload.afternoonEnd());

        WorkingHours updated = workingHoursRepository.save(workingHours);
        log.info("Orario aggiornato per il giorno {}", updated.getDayOfWeek());
        return convertToDTO(updated);
    }

    // ---------------------------- DELETE ----------------------------
    @Transactional
    public void deleteWorkingHours(UUID id) {
        if (!workingHoursRepository.existsById(id)) {
            throw new ResourceNotFoundException("Orario non trovato con id: " + id);
        }
        workingHoursRepository.deleteById(id);
        log.info("Orario {} eliminato correttamente", id);
    }

    // ---------------------------- VALIDATION ----------------------------

    private void validatePayload(NewWorkingHoursDTO payload) {
        if (!payload.closed()) {
            if (payload.morningStart() == null && payload.afternoonStart() == null) {
                throw new BadRequestException("Se il giorno non è chiuso, specifica almeno una fascia oraria.");
            }
            if (payload.morningStart() != null && payload.morningEnd() != null &&
                    !payload.morningStart().isBefore(payload.morningEnd())) {
                throw new BadRequestException("L'orario di fine mattina deve essere dopo quello di inizio.");
            }
            if (payload.afternoonStart() != null && payload.afternoonEnd() != null &&
                    !payload.afternoonStart().isBefore(payload.afternoonEnd())) {
                throw new BadRequestException("L'orario di fine pomeriggio deve essere dopo quello di inizio.");
            }
        }
    }

    // ---------------------------- CONVERTER ----------------------------
    private WorkingHoursResponseDTO convertToDTO(WorkingHours entity) {
        return new WorkingHoursResponseDTO(
                entity.getId(),
                entity.getDayOfWeek(),
                entity.getMorningStart(),
                entity.getMorningEnd(),
                entity.getAfternoonStart(),
                entity.getAfternoonEnd(),
                entity.isClosed()
        );
    }
}