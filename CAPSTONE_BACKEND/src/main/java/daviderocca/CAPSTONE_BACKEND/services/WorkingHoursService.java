package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.NewWorkingHoursDTO;
import daviderocca.CAPSTONE_BACKEND.entities.WorkingHours;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.WorkingHoursRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.util.List;
import java.util.UUID;

@Service
public class WorkingHoursService {

    @Autowired
    private WorkingHoursRepository workingHoursRepository;


    public List<WorkingHours> findAll() {
        return workingHoursRepository.findAll();
    }

    public WorkingHours findById(UUID id) {
        return workingHoursRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Orario non trovato con id: " + id));
    }

    public WorkingHours findByDayOfWeek(DayOfWeek day) {
        return workingHoursRepository.findByDayOfWeek(day)
                .orElseThrow(() -> new ResourceNotFoundException("Orari non configurati per: " + day));
    }


    public WorkingHours createWorkingHours(NewWorkingHoursDTO payload) {
        if (!payload.closed()) {
            if (payload.morningStart() == null && payload.afternoonStart() == null) {
                throw new BadRequestException("Se non è chiuso, bisogna specificare almeno una fascia oraria.");
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

        WorkingHours workingHours = new WorkingHours();
        workingHours.setDayOfWeek(payload.dayOfWeek());
        workingHours.setClosed(payload.closed());
        workingHours.setMorningStart(payload.morningStart());
        workingHours.setMorningEnd(payload.morningEnd());
        workingHours.setAfternoonStart(payload.afternoonStart());
        workingHours.setAfternoonEnd(payload.afternoonEnd());

        return workingHoursRepository.save(workingHours);
    }


    public WorkingHours updateWorkingHours(UUID id, NewWorkingHoursDTO payload) {
        if (!payload.closed()) {
            if (payload.morningStart() == null && payload.afternoonStart() == null) {
                throw new BadRequestException("Se non è chiuso, bisogna specificare almeno una fascia oraria.");
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

        WorkingHours workingHours = findById(id);
        workingHours.setDayOfWeek(payload.dayOfWeek());
        workingHours.setClosed(payload.closed());
        workingHours.setMorningStart(payload.morningStart());
        workingHours.setMorningEnd(payload.morningEnd());
        workingHours.setAfternoonStart(payload.afternoonStart());
        workingHours.setAfternoonEnd(payload.afternoonEnd());

        return workingHoursRepository.save(workingHours);
    }


    public void deleteWorkingHours(UUID id) {
        if (!workingHoursRepository.existsById(id)) {
            throw new ResourceNotFoundException("Orario non trovato con id: " + id);
        }
        workingHoursRepository.deleteById(id);
    }
}