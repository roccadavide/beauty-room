package daviderocca.CAPSTONE_BACKEND.DTO.promotionDTOs;

import daviderocca.CAPSTONE_BACKEND.enums.DiscountType;
import daviderocca.CAPSTONE_BACKEND.enums.PromotionScope;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record PromotionResponseDTO(
        UUID promotionId,
        String title,
        String subtitle,
        String description,
        String bannerImageUrl,
        String cardImageUrl,
        String ctaLabel,
        String ctaLink,
        DiscountType discountType,
        BigDecimal discountValue,
        PromotionScope scope,
        LocalDate startDate,
        LocalDate endDate,
        boolean active,
        boolean onlineOnly,
        int priority,
        List<UUID> productIds,
        List<UUID> serviceIds,
        List<UUID> categoryIds,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean currentlyActive
) {}