package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * One descriptive line of a multi-line client package composition.
 * Items do NOT carry their own session counters, prices, or durations —
 * the parent ClientPackageAssignment owns the single shared counter.
 * Each item is a pointer to either a catalog service, a catalog service+option,
 * or a free-form custom line.
 */
@Entity
@Table(name = "client_package_assignment_items")
@Getter
@Setter
@NoArgsConstructor
public class ClientPackageAssignmentItem {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false)
    private ClientPackageAssignment assignment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private ServiceItem service;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_option_id")
    private ServiceOption serviceOption;

    @Column(name = "custom_name", length = 255)
    private String customName;

    @Column(name = "position", nullable = false)
    private int position;
}
