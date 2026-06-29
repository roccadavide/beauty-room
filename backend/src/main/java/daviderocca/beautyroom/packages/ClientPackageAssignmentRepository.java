package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.enums.ClientPackageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ClientPackageAssignmentRepository extends JpaRepository<ClientPackageAssignment, UUID> {

    List<ClientPackageAssignment> findByLinkedUserUserIdOrderByCreatedAtDesc(UUID userId);

    List<ClientPackageAssignment> findByLinkedUserUserIdAndStatusOrderByCreatedAtDesc(
            UUID userId, ClientPackageStatus status);

    @Query("SELECT a FROM ClientPackageAssignment a WHERE LOWER(TRIM(a.clientName)) = LOWER(TRIM(:name)) ORDER BY a.createdAt DESC")
    List<ClientPackageAssignment> findByClientNameIgnoreCase(@Param("name") String name);

    /** Customer insights headline: count of in-store packages in the given status (ACTIVE). */
    long countByStatus(ClientPackageStatus status);

    /**
     * Customer insights: in-store package counts per client_name (free-text), excluding CANCELLED.
     * The name string is the only key these rows carry — the insights service resolves it best-effort
     * to a Customer so it can merge with the online (FK-keyed) counts. Row = [clientName (String),
     * count (Long)].
     */
    @Query("""
            SELECT a.clientName, COUNT(a)
            FROM ClientPackageAssignment a
            WHERE a.status <> daviderocca.beautyroom.enums.ClientPackageStatus.CANCELLED
            GROUP BY a.clientName
            """)
    List<Object[]> packageCountByClientName();
}
