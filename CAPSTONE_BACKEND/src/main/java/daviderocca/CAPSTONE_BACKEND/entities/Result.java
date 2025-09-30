package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "results")
@NoArgsConstructor
@Getter
@Setter
public class Result {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "result_id")
    private UUID resultId;

    private String title;

    @Column(name = "short_description")
    private String shortDescription;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ElementCollection
    private List<String> images;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public Result(String title, String shortDescription, String description, List<String> images, Category category) {
        this.title = title;
        this.shortDescription = shortDescription;
        this.description = description;
        this.images = images;
        this.category = category;
    }

    @Override
    public String toString() {
        return "Result{" +
                "resultId=" + resultId +
                ", title='" + title + '\'' +
                ", shortDescription='" + shortDescription + '\'' +
                ", description='" + description + '\'' +
                ", images=" + images +
                ", category=" + (category != null ? category.getLabel() : "null") +
                ", createdAt=" + createdAt +
                '}';
    }
}