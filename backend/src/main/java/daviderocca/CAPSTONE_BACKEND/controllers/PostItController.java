package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.PostItDTO;
import daviderocca.CAPSTONE_BACKEND.entities.PostIt;
import daviderocca.CAPSTONE_BACKEND.services.PostItService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/post-its")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class PostItController {

    private final PostItService postItService;

    @GetMapping
    public List<PostIt> findAll() {
        return postItService.findAll();
    }

    @GetMapping("/expiring-count")
    public Map<String, Long> expiringCount() {
        return Map.of("count", postItService.countExpiring());
    }

    @PostMapping
    public ResponseEntity<PostIt> create(@RequestBody PostItDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(postItService.create(dto));
    }

    @PutMapping("/{id}")
    public PostIt update(@PathVariable UUID id, @RequestBody PostItDTO dto) {
        return postItService.update(id, dto);
    }

    @PatchMapping("/{id}/done")
    public PostIt toggleDone(@PathVariable UUID id) {
        return postItService.toggleDone(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        postItService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
