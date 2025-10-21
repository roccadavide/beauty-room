package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "working_hours")
@NoArgsConstructor
@Getter
@Setter
@ToString
public class WorkingHours {

    @Id
    @GeneratedValue
    @Column(name = "working_hours_id", nullable = false, updatable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, unique = true)
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

    public WorkingHours(DayOfWeek dayOfWeek,
                        LocalTime morningStart,
                        LocalTime morningEnd,
                        LocalTime afternoonStart,
                        LocalTime afternoonEnd,
                        boolean closed) {
        this.dayOfWeek = dayOfWeek;
        this.morningStart = morningStart;
        this.morningEnd = morningEnd;
        this.afternoonStart = afternoonStart;
        this.afternoonEnd = afternoonEnd;
        this.closed = closed;
    }

    // -------------------- METHODS --------------------

    public boolean isMorningAvailable() {
        return morningStart != null && morningEnd != null && !closed;
    }

    public boolean isAfternoonAvailable() {
        return afternoonStart != null && afternoonEnd != null && !closed;
    }

    public boolean isFullDayClosed() {
        return closed || (morningStart == null && afternoonStart == null);
    }
}