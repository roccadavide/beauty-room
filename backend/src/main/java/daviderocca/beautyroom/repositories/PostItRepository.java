package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.PostIt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface PostItRepository extends JpaRepository<PostIt, UUID> {

    List<PostIt> findAllByOrderByDoneAscPriorityDescCreatedAtDesc();

    List<PostIt> findByDueDateLessThanEqualAndDoneFalse(LocalDate date);
}
