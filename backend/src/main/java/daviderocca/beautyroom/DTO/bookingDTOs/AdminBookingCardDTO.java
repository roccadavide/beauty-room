package daviderocca.beautyroom.DTO.bookingDTOs;

import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.PackageCreditStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record AdminBookingCardDTO(
        UUID bookingId,
        LocalDateTime startTime,
        LocalDateTime endTime,
        BookingStatus status,
        String customerName,
        String customerPhone,
        String customerEmail,
        String serviceTitle,
        UUID serviceId,
        String optionName,
        UUID optionId,
        Integer optionDuration,
        BigDecimal optionPrice,
        String notes,
        UUID packageCreditId,
        Integer sessionsRemaining,
        Integer sessionsTotal,
        PackageCreditStatus packageStatus,
        String stripeSessionId,
        Integer paddingMinutes,
        // Consenso PMU
        boolean consentRequired,
        boolean consentSigned,
        LocalDateTime consentSignedAt,
        // Multi-service / custom service / session tracking
        List<ServiceSummaryDTO> services,
        Boolean isCustomService,
        String customServiceName,
        Integer customServiceDurationMinutes,
        BigDecimal customServicePrice,
        // V64: whole-appointment custom total price override (null = none).
        BigDecimal customTotalPrice,
        Integer currentSession,
        Integer totalSessions,
        // Account linking
        UUID linkedUserId,
        String linkingStatus,
        // New package assignment system — deprecated singular kept for back-compat.
        // Equals linkedPackages.isEmpty() ? null : linkedPackages.get(0).
        @Deprecated
        PackageSummaryDTO linkedPackage,
        // Phase 5a: every in-person package link this booking participates in.
        // Empty when the booking is not linked to any in-person package.
        List<PackageSummaryDTO> linkedPackages,
        boolean paidInStore,
        // V62: per-line paid flag for the custom (free-form) service line.
        // Only meaningful when isCustomService == true.
        boolean customServicePaid,
        // Payment / refund
        LocalDateTime paidAt,
        boolean paidOnline,
        boolean refundable,
        LocalDateTime reminderSentAt,
        // V64 (Fase 2): the customer (matched by normalized phone) has ≥1 unsettled line on a
        // past COMPLETED booking → the agenda item shows the arretrati badge. Populated by a
        // single batch query in getAgendaRange/getAgendaDay; false everywhere else.
        boolean hasOutstanding,
        // Phase 08.3: every promotion frozen onto this booking (snapshot). Empty when none.
        List<PromoSummaryDTO> linkedPromotions,
        // BE-2 (scope A): standalone product sales on this booking (promotion_link_id IS NULL).
        // Promo product-lines stay inside linkedPromotions. Empty when none.
        List<SaleSummaryDTO> linkedSales,
        // feat/online-pay-in-store: true when Michela created the appointment; false when
        // the customer booked it online (Stripe or pay-in-store). Combined with stripeSessionId,
        // the agenda tells a "prenotato online" pay-in-store booking from an admin-made one.
        boolean createdByAdmin,
        // true when the booking's account is a verified ("trusted") customer. Derived in
        // toAdminCard as user.isVerified || linkedUser.isVerified (online bookings carry the
        // account in user; Michela-created auto-linked ones in linkedUser).
        boolean customerVerified
) {}
