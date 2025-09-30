package daviderocca.CAPSTONE_BACKEND.entities;


import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "services")
@NoArgsConstructor
@Getter
@Setter
public class ServiceItem {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "service_id")
    private UUID serviceId;

    private String title;

    @Column(name = "duration_min")
    private int durationMin;

    private BigDecimal price;

    private String shortDescription;

    @Column(columnDefinition = "TEXT")
    private  String description;

    @ElementCollection
    private List<String> images;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    @OneToMany(mappedBy = "service")
    private List<Booking> bookings;

    public ServiceItem(String title, int durationMin, BigDecimal price, String shortDescription, String description, List<String> images, Category category) {
        this.title = title;
        this.durationMin = durationMin;
        this.price = price;
        this.shortDescription = shortDescription;
        this.description = description;
        this.images = images;
        this.category = category;
    }


    @Override
    public String toString() {
        return "Service{" +
                "serviceId=" + serviceId +
                ", title='" + title + '\'' +
                ", durationMin=" + durationMin +
                ", price='" + price + '\'' +
                ", shortDescription='" + shortDescription + '\'' +
                ", description='" + description + '\'' +
                ", images=" + images +
                '}';
    }
}
