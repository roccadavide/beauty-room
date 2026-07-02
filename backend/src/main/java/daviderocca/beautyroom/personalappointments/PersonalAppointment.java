package daviderocca.beautyroom.personalappointments;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "personal_appointments")
@Getter
@Setter
@NoArgsConstructor
public class PersonalAppointment {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "appointment_date", nullable = false)
    private LocalDate appointmentDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes = 60;

    // V83 (multi-staff prompt 01): whose personal time this blocks. Nullable until
    // the final hardening migration; create/update set it via DefaultStaffResolver.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id")
    private daviderocca.beautyroom.staff.StaffMember staffMember;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
