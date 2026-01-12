package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "service_options")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = "service")
public class ServiceOption {

    @Id
    @GeneratedValue
    @Column(name = "option_id")
    private UUID optionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id", nullable = false)
    private ServiceItem service;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "sessions")
    private Integer sessions;

    @Column(name = "gender", length = 20)
    private String gender;

    @Column(name = "active", nullable = false)
    private boolean active = true;

}
