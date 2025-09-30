package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.NewWorkingHoursDTO;
import daviderocca.CAPSTONE_BACKEND.entities.WorkingHours;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.WorkingHoursService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/working-hours")
@Slf4j
@PreAuthorize("hasRole('ADMIN')")
public class WorkingHoursController {

    @Autowired
    private WorkingHoursService workingHoursService;

    // --------------------- GET ---------------------
    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public List<WorkingHours> getAll() {
        log.info("Richiesta elenco orari di lavoro");
        return workingHoursService.findAll();
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public WorkingHours getById(@PathVariable UUID id) {
        log.info("Richiesta orario di lavoro con id {}", id);
        return workingHoursService.findById(id);
    }

    @GetMapping("/day/{day}")
    @ResponseStatus(HttpStatus.OK)
    public WorkingHours getByDay(@PathVariable DayOfWeek day) {
        log.info("Richiesta orario di lavoro per il giorno {}", day);
        return workingHoursService.findByDayOfWeek(day);
    }

    // --------------------- POST ---------------------
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkingHours createWorkingHours(@Valid @RequestBody NewWorkingHoursDTO payload, BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }
        log.info("Creazione nuovo orario per {}", payload.dayOfWeek());
        return workingHoursService.createWorkingHours(payload);
    }

    // --------------------- PUT ---------------------
    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public WorkingHours updateWorkingHours(@PathVariable UUID id,
                               @Valid @RequestBody NewWorkingHoursDTO payload,
                               BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }
        log.info("Aggiornamento orario con id {}", id);
        return workingHoursService.updateWorkingHours(id, payload);
    }

    // --------------------- DELETE ---------------------
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWorkingHours(@PathVariable UUID id) {
        log.info("Eliminazione orario con id {}", id);
        workingHoursService.deleteWorkingHours(id);
    }
}