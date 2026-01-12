package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(
        name="closures",
        indexes = {
                @Index(name="idx_closure_date", columnList="date")
        }
)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
@ToString
public class Closure {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "closure_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "reason", nullable = false, length = 150)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Closure(LocalDate date, LocalTime startTime, LocalTime endTime, String reason) {
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.reason = reason;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public boolean isFullDay() {
        return startTime == null && endTime == null;
    }
}