package daviderocca.beautyroom.staff;

import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A person who works in the salon and owns an agenda column (V82).
 * Inert in prompt 01: rows exist and every new Booking/PersonalAppointment/
 * BookingSale carries one, but no read path uses them yet.
 */
@Entity
@Table(name = "staff_members")
@Getter
@Setter
@NoArgsConstructor
public class StaffMember {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    // Optional login account (the owner's ADMIN user; STAFF users from prompt 02).
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;

    // Agenda accent, hex "#RRGGBB".
    @Column(name = "color", length = 7)
    private String color;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Qualification matrix (R4): the services this staff member performs.
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "staff_services",
            joinColumns = @JoinColumn(name = "staff_id"),
            inverseJoinColumns = @JoinColumn(name = "service_id")
    )
    private Set<ServiceItem> services = new HashSet<>();

    public StaffMember(String displayName, boolean active, int sortOrder) {
        this.displayName = displayName;
        this.active = active;
        this.sortOrder = sortOrder;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
