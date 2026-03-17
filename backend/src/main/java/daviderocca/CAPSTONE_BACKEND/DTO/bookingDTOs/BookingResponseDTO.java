package daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs;


import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;

import java.time.LocalDateTime;
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
        UUID userId, // opzionale se è un utente registrato
        // FIX-18: titolo del servizio per evitare di mostrare UUID grezzo in BookingSuccessPage
        String serviceTitle
) {}