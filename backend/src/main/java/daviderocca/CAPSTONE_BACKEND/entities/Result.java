package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "results")
@NoArgsConstructor
@Getter
@Setter
@ToString(exclude = "category")
public class Result {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "result_id", nullable = false, updatable = false)
    private UUID resultId;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(name = "short_description", length = 255)
    private String shortDescription;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "result_images", joinColumns = @JoinColumn(name = "result_id"))
    @Column(name = "image_url")
    private List<String> images;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Result(String title, String shortDescription, String description, List<String> images, Category category) {
        this.title = title;
        this.shortDescription = shortDescription;
        this.description = description;
        this.images = images;
        this.category = category;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}