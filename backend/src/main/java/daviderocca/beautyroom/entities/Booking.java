package daviderocca.beautyroom.entities;

import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.LinkingStatus;
import daviderocca.beautyroom.enums.PaymentMethod;
import daviderocca.beautyroom.entities.Customer;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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

    // PROMPT B: pre-move start, persisted so the async "spostato" email can show Prima → Ora.
    // Nullable: set only when an appointment is actually moved (see BookingService update paths).
    @Column(name = "previous_start_time")
    private LocalDateTime previousStartTime;

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

    @Column(name="review_request_sent_at")
    private LocalDateTime reviewRequestSentAt;

    @Column(name = "reminder_sent_at")
    private LocalDateTime reminderSentAt;

    @Column(name = "padding_minutes")
    private Integer paddingMinutes; 

    @Column(name = "created_by_admin", nullable = false)
    private boolean createdByAdmin = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20)
    private PaymentMethod paymentMethod = PaymentMethod.PAID_ONLINE;

    @Column(name = "consent_laser", nullable = false)
    private boolean consentLaser = false;

    @Column(name = "consent_pmu", nullable = false)
    private boolean consentPmu = false;

    @Column(name = "consent_at")
    private LocalDateTime consentAt;

    @Column(name = "consent_signed", nullable = false)
    private boolean consentSigned = false;

    @Column(name = "consent_signed_at")
    private LocalDateTime consentSignedAt;

    @Column(name = "is_no_show", nullable = false)
    private boolean noShow = false;

    @Column(name = "paid_in_store", nullable = false)
    private boolean paidInStore = false;

    // V62: per-line "paid" status for the custom (free-form) service line.
    // The catalog and package counterparts live on booking_services.paid and
    // booking_package_link.paid respectively.
    @Column(name = "custom_service_paid", nullable = false)
    private boolean customServicePaid = false;

    // V72: online PackageCredit consume tracking. Mirrors the admin path's
    // BookingPackageLink.sessionTrackedAtCreation. TRUE when this booking currently holds one
    // decrement against its linked online PackageCredit (the session is consumed at BOOKING
    // time now, not at completion). Flips back to FALSE when the session is restored on
    // cancel / no-show. Guards consume/restore idempotency — see PackageCreditService.
    @Column(name = "credit_tracked_at_creation", nullable = false)
    private boolean creditTrackedAtCreation = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private ServiceItem service;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_option_id")
    private ServiceOption serviceOption;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="package_credit_id")
    private PackageCredit packageCredit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    // Multi-service list — all catalog services on this booking
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "booking_services",
        joinColumns = @JoinColumn(name = "booking_id"),
        inverseJoinColumns = @JoinColumn(name = "service_id")
    )
    private List<ServiceItem> services = new ArrayList<>();

    // Custom service — Michela writes a free-form service name
    @Column(name = "is_custom_service", nullable = false)
    private boolean customService = false;

    @Column(name = "custom_service_name", length = 255)
    private String customServiceName;

    @Column(name = "custom_service_price", precision = 10, scale = 2)
    private BigDecimal customServicePrice;

    // V64: custom total price for the WHOLE appointment (a "bundle" override).
    // NULL = no override (per-line prices win, as today). When set, the
    // appointment is one atomic payment unit and its per-line paid flags move
    // in lockstep (see BookingService.settleBookingLines). Distinct from
    // customServicePrice (which is only the price of the free-form line).
    @Column(name = "custom_total_price", precision = 10, scale = 2)
    private BigDecimal customTotalPrice;

    // Per-custom-service duration (V61, Phase 6e). The frontend always sent it
    // on create; before V61 it wasn't persisted and the response builder
    // inferred it as (total − catalog sum), which inflated when packages were
    // also linked → custom duration doubled on every edit. NULL on pre-V61
    // rows; the builder falls back to the legacy inference for those.
    @Column(name = "custom_service_duration_min")
    private Integer customServiceDurationMin;

    // Session tracking (e.g. "session 2 of 6")
    @Column(name = "current_session")
    private Integer currentSession;

    @Column(name = "total_sessions")
    private Integer totalSessions;

    // Pre-computed total duration in minutes (sum of all services)
    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    // Auto account-linking (best-effort, nullable)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_user_id")
    private User linkedUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "linking_status", nullable = false, length = 20)
    private LinkingStatus linkingStatus = LinkingStatus.NONE;

    // NOTE: Lombok should generate this via @Getter, but we keep an explicit getter
    // because tests and services rely on it and we want to avoid any Lombok edge-cases
    // with JPA proxy types across toolchains.
    public Customer getCustomer() {
        return customer;
    }

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