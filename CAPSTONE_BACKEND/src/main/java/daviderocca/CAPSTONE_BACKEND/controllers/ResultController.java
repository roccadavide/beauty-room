package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.NewResultDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.ResultResponseDTO;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.services.ResultService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/results")
@Slf4j
public class ResultController {

    @Autowired
    private ResultService resultService;

    // ---------------------------------- GET  ----------------------------------
    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public Page<ResultResponseDTO> getAllResults(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sort
    ) {
        log.info("Richiesta elenco risultati - pagina: {}, size: {}, sort: {}", page, size, sort);
        return resultService.findAllResults(page, size, sort);
    }

    @GetMapping("/{resultId}")
    @ResponseStatus(HttpStatus.OK)
    public ResultResponseDTO getResultById(@PathVariable UUID resultId) {
        log.info("Richiesta dettaglio risultato {}", resultId);
        return resultService.findResultByIdAndConvert(resultId);
    }

    // ---------------------------------- POST ----------------------------------
    @PostMapping("/postResult")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ResultResponseDTO createResult(@Validated @RequestPart(value = "data") NewResultDTO payload,
                                          @RequestPart(value = "image", required = false) MultipartFile image,
                                          BindingResult bindingResult) {

        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta creazione risultato {}", payload.title());
        return resultService.saveResult(payload, image);
    }

    // ---------------------------------- PUT ----------------------------------
    @PutMapping("/{resultId}")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('ADMIN')")
    public ResultResponseDTO updateResult(
            @PathVariable UUID resultId,
            @Validated @RequestPart(value = "data") NewResultDTO payload,
            @RequestPart(value = "image", required = false) MultipartFile image,
            BindingResult bindingResult
    ) {
        if (bindingResult.hasErrors()) {
            throw new BadRequestException(bindingResult.getAllErrors().stream()
                    .map(e -> e.getDefaultMessage())
                    .collect(Collectors.joining(", ")));
        }

        log.info("Richiesta aggiornamento risultato {}", resultId);
        return resultService.updateResult(resultId, payload, image);
    }

    // ---------------------------------- DELETE ----------------------------------
    @DeleteMapping("/{resultId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteResult(@PathVariable UUID resultId) {
        log.info("Richiesta eliminazione risultato {}", resultId);
        resultService.deleteResult(resultId);
    }
}