package daviderocca.beautyroom.DTO.bookingDTOs;

import daviderocca.beautyroom.enums.BookingStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record BookingResponseDTO(
        UUID bookingId,
        String customerName,
        String customerEmail,
        String customerPhone,
        LocalDateTime startTime,
        LocalDateTime endTime,
        BookingStatus bookingStatus,
        String notes,
        LocalDateTime createdAt,
        UUID serviceId,
        UUID serviceOptionId,
        UUID userId,
        // FIX-18: titolo del servizio per evitare di mostrare UUID grezzo in BookingSuccessPage
        String serviceTitle,
        // Multi-service
        List<ServiceSummaryDTO> services,
        Boolean isCustomService,
        String customServiceName,
        BigDecimal customServicePrice,
        // V64: whole-appointment custom total price override (null = none).
        BigDecimal customTotalPrice,
        Integer durationMinutes,
        Integer currentSession,
        Integer totalSessions,
        String linkingStatus,
        PackageSummaryDTO linkedPackage,
        boolean paidInStore
) {}
