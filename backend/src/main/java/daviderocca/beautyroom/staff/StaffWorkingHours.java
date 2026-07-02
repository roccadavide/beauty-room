package daviderocca.beautyroom.staff;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Per-staff weekly hours (V82) — same shape as the legacy {@code working_hours}
 * table (one row per day, morning + afternoon ranges) plus the staff FK.
 * The availability engine starts reading these in prompt 06.
 */
@Entity
@Table(
        name = "staff_working_hours",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_staff_working_hours_staff_day",
                columnNames = {"staff_id", "day_of_week"})
)
@Getter
@Setter
@NoArgsConstructor
public class StaffWorkingHours {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "staff_id", nullable = false)
    private StaffMember staffMember;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 16)
    private DayOfWeek dayOfWeek;

    @Column(name = "morning_start")
    private LocalTime morningStart;

    @Column(name = "morning_end")
    private LocalTime morningEnd;

    @Column(name = "afternoon_start")
    private LocalTime afternoonStart;

    @Column(name = "afternoon_end")
    private LocalTime afternoonEnd;

    @Column(name = "closed", nullable = false)
    private boolean closed = false;

    // -------------------- METHODS (mirror WorkingHours) --------------------

    public boolean isMorningAvailable() {
        return morningStart != null && morningEnd != null && !closed;
    }

    public boolean isAfternoonAvailable() {
        return afternoonStart != null && afternoonEnd != null && !closed;
    }

    public boolean isFullDayClosed() {
        return closed;
    }
}
