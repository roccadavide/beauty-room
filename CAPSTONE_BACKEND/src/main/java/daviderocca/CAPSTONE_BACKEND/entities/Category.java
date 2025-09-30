package daviderocca.CAPSTONE_BACKEND.entities;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "categories")
@NoArgsConstructor
@Getter
@Setter
public class Category {

    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "category_id")
    private UUID categoryId;

    @Column(name = "category_key")
    private String categoryKey;

    private String label;

    @OneToMany(mappedBy = "category")
    private List<Product> products;

    @OneToMany(mappedBy = "category")
    private List<ServiceItem> services;

    @OneToMany(mappedBy = "category")
    private List<Result> results;

    public Category(String categoryKey, String label) {
        this.categoryKey = categoryKey;
        this.label = label;
    }

    @Override
    public String toString() {
        return "Category{" +
                "categoryId=" + categoryId +
                ", categoryKey='" + categoryKey + '\'' +
                ", label='" + label + '\'' +
                '}';
    }
}
