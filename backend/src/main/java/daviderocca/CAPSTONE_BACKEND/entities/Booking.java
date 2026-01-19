package daviderocca.CAPSTONE_BACKEND.entities;

import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "bookings",
        indexes = {
                @Index(name="idx_booking_start", columnList="start_time"),
                @Index(name="idx_booking_end", columnList="end_time"),
                @Index(name="idx_booking_status", columnList="booking_status"),
                @Index(name="idx_booking_service", columnList="service_id"),
                @Index(name="idx_booking_email", columnList="customer_email"),
                @Index(name="idx_booking_expires", columnList="expires_at"),
                @Index(name="idx_booking_stripe_session", columnList="stripe_session_id"),
                @Index(name="idx_booking_pkg_credit", columnList="package_credit_id")
        }
)
@NoArgsConstructor
@Getter
@Setter
@ToString(exclude = {"user", "service", "serviceOption", "packageCredit"})
public class Booking {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "booking_id", updatable = false, nullable = false)
    private UUID bookingId;

    @Column(name = "customer_name", nullable = false, length = 50)
    private String customerName;

    @Column(name = "customer_email", nullable = false, length = 100)
    private String customerEmail;

    @Column(name = "customer_phone", nullable = false, length = 20)
    private String customerPhone;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "booking_status", nullable = false, length = 20)
    private BookingStatus bookingStatus = BookingStatus.PENDING_PAYMENT;

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name="stripe_session_id", length = 120)
    private String stripeSessionId;

    @Column(name="expires_at")
    private LocalDateTime expiresAt;

    @Column(name="paid_at")
    private LocalDateTime paidAt;

    @Column(name="created_at", nullable=false, updatable=false)
    private LocalDateTime createdAt;

    @Column(name="updated_at")
    private LocalDateTime updatedAt;

    @Column(name="canceled_at")
    private LocalDateTime canceledAt;

    @Column(name="cancel_reason", length = 80)
    private String cancelReason;

    @Column(name="completed_at")
    private LocalDateTime completedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id", nullable = false)
    private ServiceItem service;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_option_id")
    private ServiceOption serviceOption;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="package_credit_id", unique = true)
    private PackageCredit packageCredit;

    public Booking(String customerName, String customerEmail, String customerPhone,
                   LocalDateTime startTime, LocalDateTime endTime, String notes,
                   ServiceItem service, ServiceOption serviceOption, User user) {
        this.customerName = customerName;
        this.customerEmail = customerEmail;
        this.customerPhone = customerPhone;
        this.startTime = startTime;
        this.endTime = endTime;
        this.notes = notes;
        this.service = service;
        this.serviceOption = serviceOption;
        this.user = user;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}