package daviderocca.CAPSTONE_BACKEND.DTO;

import lombok.Data;
import java.time.LocalDate;

@Data
public class PostItDTO {
    private String title;
    private String description;
    private String color;
    private LocalDate dueDate;
    private Integer priority;
}
