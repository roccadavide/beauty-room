package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "categories")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
@ToString(exclude = {"products", "services", "results"})
public class Category {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "category_id", updatable = false, nullable = false)
    private UUID categoryId;

    @Column(name = "category_key", nullable = false, unique = true, length = 50)
    private String categoryKey;

    @Column(name = "label", nullable = false, length = 100)
    private String label;

    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = false)
    private List<Product> products;

    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = false)
    private List<ServiceItem> services;

    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = false)
    private List<Result> results;

    public Category(String categoryKey, String label) {
        this.categoryKey = categoryKey;
        this.label = label;
    }
}