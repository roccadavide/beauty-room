package daviderocca.beautyroom.likes;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface LikeRepository extends JpaRepository<Like, Long> {

    boolean existsByEntityTypeAndEntityIdAndIpHashAndCreatedAtAfter(
            String entityType, UUID entityId, String ipHash, LocalDateTime after);

    List<Like> findByEntityTypeAndEntityIdAndIpHashAndCreatedAtAfter(
            String entityType, UUID entityId, String ipHash, LocalDateTime after);
}
