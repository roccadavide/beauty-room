package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.Booking;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Links one booking to one session of a ClientPackageAssignment.
 * A booking can only be linked to one assignment, and each (booking, assignment)
 * pair is unique — enforced by the UNIQUE constraint on the join table.
 */
@Entity
@Table(
    name = "booking_package_link",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_booking_pkg_link",
        columnNames = {"booking_id", "client_package_assignment_id"}
    )
)
@Getter
@Setter
@NoArgsConstructor
public class BookingPackageLink {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_package_assignment_id", nullable = false)
    private ClientPackageAssignment assignment;

    @Column(name = "session_number", nullable = false)
    private int sessionNumber;

    @Column(name = "linked_at", nullable = false, updatable = false)
    private LocalDateTime linkedAt;

    /**
     * True when sessions were decremented / directly set at booking-creation time
     * (admin CASE A/B/C). Prevents double-counting if booking is later marked COMPLETED.
     */
    @Column(name = "session_tracked_at_creation", nullable = false)
    private boolean sessionTrackedAtCreation = false;

    // V62: per-session payment status. Only meaningful when the parent
    // ClientPackageAssignment.paidUpfront is FALSE — when paidUpfront is TRUE
    // the whole package is settled and this flag is ignored by the UI.
    @Column(name = "paid", nullable = false)
    private boolean paid = false;

    @PrePersist
    void onCreate() {
        linkedAt = LocalDateTime.now();
    }
}
