package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "closures")
@Getter
@Setter
@NoArgsConstructor
public class Closure {

    @Id
    @GeneratedValue
    @Column(name = "closure_id")
    private UUID id;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "reason")
    private String reason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public boolean isFullDay() {
        return startTime == null && endTime == null;
    }

    public Closure(LocalDate date, LocalTime startTime, LocalTime endTime, String reason) {
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.reason = reason;
    }

    @Override
    public String toString() {
        return "Closure{" +
                "id=" + id +
                ", date=" + date +
                ", startTime=" + startTime +
                ", endTime=" + endTime +
                ", reason='" + reason + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}