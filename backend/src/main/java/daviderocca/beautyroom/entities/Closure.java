package daviderocca.beautyroom.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(
        name = "closures",
        indexes = {
                @Index(name = "idx_closure_date",  columnList = "date"),
                @Index(name = "idx_closure_range", columnList = "start_date,end_date")
        }
)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
@ToString(exclude = "staffMember")
public class Closure {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "closure_id", nullable = false, updatable = false)
    private UUID id;

    // Legacy column: still NOT NULL in DB. Kept in sync with startDate on every save.
    // A later migration will drop it once no code path references it.
    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "reason", nullable = false, length = 150)
    private String reason;

    // V83 (multi-staff prompt 01): NULL = salon-wide closure (all existing rows);
    // non-NULL = per-staff absence (written from prompt 03 onward).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id")
    private daviderocca.beautyroom.staff.StaffMember staffMember;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Closure(LocalDate startDate, LocalDate endDate,
                   LocalTime startTime, LocalTime endTime, String reason) {
        this.startDate = startDate;
        this.endDate = (endDate != null) ? endDate : startDate;
        this.startTime = startTime;
        this.endTime = endTime;
        this.reason = reason;
        this.date = this.startDate;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.endDate == null) this.endDate = this.startDate;
        if (this.date == null) this.date = this.startDate;
    }

    @PreUpdate
    void onUpdate() {
        if (this.endDate == null) this.endDate = this.startDate;
        if (this.startDate != null) this.date = this.startDate;
    }

    public boolean isFullDay() {
        return startTime == null && endTime == null;
    }

    public boolean isMultiDay() {
        return endDate != null && startDate != null && endDate.isAfter(startDate);
    }

    public boolean coversDate(LocalDate d) {
        if (d == null || startDate == null || endDate == null) return false;
        return !d.isBefore(startDate) && !d.isAfter(endDate);
    }
}
