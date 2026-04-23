package daviderocca.beautyroom.entities;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "app_settings")
@NoArgsConstructor
@Getter
@Setter
public class AppSettings {

    @Id
    @Column(name = "key", nullable = false, length = 100)
    private String key;

    @Column(name = "value", nullable = false)
    private String value;
}
