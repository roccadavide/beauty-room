package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "services")
@NoArgsConstructor
@Getter
@Setter
@ToString(exclude = {"category", "bookings", "options", "promotions"})
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

    @Column(nullable = false)
    private boolean active = true;

    /** Badge attivi in formato JSON array string, es. ["new","sale"] oppure null. */
    @Column(length = 500)
    private String badges;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "service_images", joinColumns = @JoinColumn(name = "service_id"))
    @Column(name = "image_url")
    private Set<String> images = new LinkedHashSet<>();

    @ManyToMany(mappedBy = "services", fetch = FetchType.LAZY)
    private Set<Promotion> promotions = new HashSet<>();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @OneToMany(mappedBy = "service", fetch = FetchType.LAZY)
    private Set<Booking> bookings = new HashSet<>();

    @OneToMany(mappedBy = "service", fetch = FetchType.LAZY)
    private Set<ServiceOption> options = new HashSet<>();

    public ServiceItem(String title, int durationMin, BigDecimal price, String shortDescription,
                       String description, java.util.Collection<String> images, Category category) {
        this.title = title;
        this.durationMin = durationMin;
        this.price = price;
        this.shortDescription = shortDescription;
        this.description = description;
        if (images != null) {
            this.images = new LinkedHashSet<>(images);
        }
        this.category = category;
    }
}