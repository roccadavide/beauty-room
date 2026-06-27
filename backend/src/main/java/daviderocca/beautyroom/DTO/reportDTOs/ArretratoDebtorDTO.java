package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One debtor in the chase-able arrears list: who owes ({@code clientName} + {@code phone}
 * for the WhatsApp link), how much ({@code amount}, summed across all their unpaid
 * bookings) and since when ({@code since} = their oldest unpaid appointment date).
 */
public record ArretratoDebtorDTO(
        String clientName,
        String phone,
        BigDecimal amount,
        LocalDate since
) {}
