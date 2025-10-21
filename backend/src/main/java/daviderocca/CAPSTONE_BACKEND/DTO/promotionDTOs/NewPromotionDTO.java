package daviderocca.CAPSTONE_BACKEND.DTO.promotionDTOs;

import daviderocca.CAPSTONE_BACKEND.enums.DiscountType;
import daviderocca.CAPSTONE_BACKEND.enums.PromotionScope;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record NewPromotionDTO(
        @NotBlank String title,
        String subtitle,
        String description,
        String ctaLabel,
        String ctaLink,
        @NotNull DiscountType discountType,
        @Positive BigDecimal discountValue,
        PromotionScope scope,
        LocalDate startDate,
        LocalDate endDate,
        boolean active,
        boolean onlineOnly,
        int priority,
        List<UUID> productIds,
        List<UUID> serviceIds,
        List<UUID> categoryIds
) {}