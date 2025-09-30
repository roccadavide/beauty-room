package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.NewClosureDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Closure;
import daviderocca.CAPSTONE_BACKEND.services.ClosureService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/closures")
@PreAuthorize("hasRole('ADMIN')")
public class ClosureController {

    @Autowired
    private ClosureService closureService;

    @GetMapping
    public List<Closure> getAllClosure() {
        return closureService.findAllClosure();
    }

    @PostMapping
    public Closure createClosure(@RequestBody @Validated NewClosureDTO payload) {
        return closureService.createClosure(payload);
    }

    @PutMapping("/{id}")
    public Closure updateClosure(@PathVariable UUID id, @RequestBody @Validated NewClosureDTO payload) {
        return closureService.updateClosure(id, payload);
    }

    @DeleteMapping("/{id}")
    public void deleteClosure(@PathVariable UUID id) {
        closureService.deleteClosure(id);
    }
}