package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.PostItDTO;
import daviderocca.CAPSTONE_BACKEND.entities.PostIt;
import daviderocca.CAPSTONE_BACKEND.repositories.PostItRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PostItService {

    private final PostItRepository repo;

    public List<PostIt> findAll() {
        return repo.findAllByOrderByDoneAscPriorityDescCreatedAtDesc();
    }

    public long countExpiring() {
        return repo.findByDueDateLessThanEqualAndDoneFalse(LocalDate.now()).size();
    }

    @Transactional
    public PostIt create(PostItDTO dto) {
        PostIt p = new PostIt();
        applyDTO(p, dto);
        return repo.save(p);
    }

    @Transactional
    public PostIt update(UUID id, PostItDTO dto) {
        PostIt p = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Post-it non trovato: " + id));
        applyDTO(p, dto);
        return repo.save(p);
    }

    @Transactional
    public PostIt toggleDone(UUID id) {
        PostIt p = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Post-it non trovato: " + id));
        p.setDone(!p.isDone());
        return repo.save(p);
    }

    @Transactional
    public void delete(UUID id) {
        repo.deleteById(id);
    }

    private void applyDTO(PostIt p, PostItDTO dto) {
        if (dto.getTitle() != null && !dto.getTitle().isBlank()) p.setTitle(dto.getTitle().trim());
        if (dto.getDescription() != null) p.setDescription(dto.getDescription().trim());
        if (dto.getColor() != null) p.setColor(dto.getColor());
        if (dto.getDueDate() != null) p.setDueDate(dto.getDueDate()); else p.setDueDate(null);
        if (dto.getPriority() != null) p.setPriority(dto.getPriority());
    }
}
