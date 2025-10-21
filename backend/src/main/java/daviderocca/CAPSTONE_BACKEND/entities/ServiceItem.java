package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "services")
@NoArgsConstructor
@Getter
@Setter
@ToString(exclude = {"category", "bookings"})
public class ServiceItem {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "service_id", nullable = false, updatable = false)
    private UUID serviceId;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(name = "duration_min", nullable = false)
    private int durationMin;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "short_description", length = 255)
    private String shortDescription;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "service_images", joinColumns = @JoinColumn(name = "service_id"))
    @Column(name = "image_url")
    private List<String> images;

    @ManyToMany(mappedBy = "services", fetch = FetchType.LAZY)
    private List<Promotion> promotions = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @OneToMany(mappedBy = "service", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Booking> bookings;

    public ServiceItem(String title, int durationMin, BigDecimal price, String shortDescription,
                       String description, List<String> images, Category category) {
        this.title = title;
        this.durationMin = durationMin;
        this.price = price;
        this.shortDescription = shortDescription;
        this.description = description;
        this.images = images;
        this.category = category;
    }
}