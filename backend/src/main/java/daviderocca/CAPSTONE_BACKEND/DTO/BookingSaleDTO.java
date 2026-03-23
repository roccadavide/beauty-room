package daviderocca.CAPSTONE_BACKEND.DTO;

import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class BookingSaleDTO {
    private UUID productId;
    private String productName;
    private int quantity;
    private BigDecimal unitPrice;
}
