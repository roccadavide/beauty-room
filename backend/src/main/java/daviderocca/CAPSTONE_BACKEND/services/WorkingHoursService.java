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
import java.time.LocalTime;
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

        // evita record doppi (unique = true lato DB, ma meglio errore pulito)
        workingHoursRepository.findByDayOfWeek(payload.dayOfWeek()).ifPresent(existing -> {
            throw new BadRequestException("Orari già presenti per " + payload.dayOfWeek() + ". Usa PUT per modificarli.");
        });

        WorkingHours workingHours = new WorkingHours();
        applyPayload(workingHours, payload);

        WorkingHours saved = workingHoursRepository.save(workingHours);
        log.info("Orario creato per il giorno {}", saved.getDayOfWeek());
        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE ----------------------------

    @Transactional
    public WorkingHoursResponseDTO updateWorkingHours(UUID id, NewWorkingHoursDTO payload) {
        validatePayload(payload);

        WorkingHours workingHours = findById(id);

        // opzionale ma consigliato: impedisci di “spostare” un record su un day già occupato
        workingHoursRepository.findByDayOfWeek(payload.dayOfWeek()).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new BadRequestException("Esistono già orari per " + payload.dayOfWeek() + ". Non puoi duplicare il giorno.");
            }
        });

        applyPayload(workingHours, payload);

        WorkingHours updated = workingHoursRepository.save(workingHours);
        log.info("Orario aggiornato per il giorno {}", updated.getDayOfWeek());
        return convertToDTO(updated);
    }

    // ---------------------------- APPLY / VALIDATION ----------------------------

    private void applyPayload(WorkingHours entity, NewWorkingHoursDTO payload) {
        entity.setDayOfWeek(payload.dayOfWeek());
        entity.setClosed(payload.closed());

        if (payload.closed()) {
            entity.setMorningStart(null);
            entity.setMorningEnd(null);
            entity.setAfternoonStart(null);
            entity.setAfternoonEnd(null);
        } else {
            entity.setMorningStart(payload.morningStart());
            entity.setMorningEnd(payload.morningEnd());
            entity.setAfternoonStart(payload.afternoonStart());
            entity.setAfternoonEnd(payload.afternoonEnd());
        }
    }

    private void validatePayload(NewWorkingHoursDTO payload) {
        if (payload.dayOfWeek() == null) {
            throw new BadRequestException("Il giorno della settimana è obbligatorio.");
        }

        if (payload.closed()) {
            if (payload.morningStart() != null || payload.morningEnd() != null
                    || payload.afternoonStart() != null || payload.afternoonEnd() != null) {
                throw new BadRequestException("Se closed=true non devi inserire fasce orarie (verranno annullate).");
            }
            return;
        }

        boolean hasMorning = payload.morningStart() != null || payload.morningEnd() != null;
        boolean hasAfternoon = payload.afternoonStart() != null || payload.afternoonEnd() != null;

        if (!hasMorning && !hasAfternoon) {
            throw new BadRequestException("Se il giorno non è chiuso, specifica almeno una fascia oraria.");
        }

        validateRange(payload.morningStart(), payload.morningEnd(), "mattina");
        validateRange(payload.afternoonStart(), payload.afternoonEnd(), "pomeriggio");

        if (payload.morningStart() != null && payload.morningEnd() != null
                && payload.afternoonStart() != null && payload.afternoonEnd() != null) {
            if (!payload.morningEnd().isBefore(payload.afternoonStart())) {
                throw new BadRequestException("La fascia mattina deve finire prima dell’inizio del pomeriggio.");
            }
        }
    }

    private void validateRange(LocalTime start, LocalTime end, String label) {
        if (start == null && end == null) return;
        if (start == null || end == null) {
            throw new BadRequestException("Per la fascia " + label + " devi inserire sia start che end.");
        }
        if (!start.isBefore(end)) {
            throw new BadRequestException("La fascia " + label + " non è valida: l’orario di fine deve essere dopo l’inizio.");
        }
    }

    @Transactional
    public List<WorkingHoursResponseDTO> initDefaultWeekIfMissing() {

        LocalTime morningStart = LocalTime.of(9, 0);
        LocalTime morningEnd   = LocalTime.of(12, 30);
        LocalTime aftStart     = LocalTime.of(14, 0);
        LocalTime aftEnd       = LocalTime.of(19, 0);

        for (DayOfWeek day : DayOfWeek.values()) {

            if (workingHoursRepository.existsByDayOfWeek(day)) continue;

            boolean weekend = (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY);

            WorkingHours wh = new WorkingHours();
            wh.setDayOfWeek(day);
            wh.setClosed(weekend);

            if (!weekend) {
                wh.setMorningStart(morningStart);
                wh.setMorningEnd(morningEnd);
                wh.setAfternoonStart(aftStart);
                wh.setAfternoonEnd(aftEnd);
            }

            workingHoursRepository.save(wh);
            log.info("Seed working hours created for {}", day);
        }

        return findAll();
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