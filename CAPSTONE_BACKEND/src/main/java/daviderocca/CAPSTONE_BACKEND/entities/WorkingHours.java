package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "working_hours")
@Getter
@Setter
@NoArgsConstructor
public class WorkingHours {

    @Id
    @GeneratedValue
    @Column(name = "working_hours_id")
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false)
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

    public WorkingHours(DayOfWeek dayOfWeek, LocalTime morningStart, LocalTime morningEnd, LocalTime afternoonStart, LocalTime afternoonEnd, boolean closed) {
        this.dayOfWeek = dayOfWeek;
        this.morningStart = morningStart;
        this.morningEnd = morningEnd;
        this.afternoonStart = afternoonStart;
        this.afternoonEnd = afternoonEnd;
        this.closed = closed;
    }

    @Override
    public String toString() {
        return "WorkingHours{" +
                "id=" + id +
                ", dayOfWeek=" + dayOfWeek +
                ", morningStart=" + morningStart +
                ", morningEnd=" + morningEnd +
                ", afternoonStart=" + afternoonStart +
                ", afternoonEnd=" + afternoonEnd +
                ", closed=" + closed +
                '}';
    }
}