package daviderocca.beautyroom.packages;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Admin-saved reusable package "recipe". A pure blueprint — it has NO client,
 * NO session counters, NO paid/status. When the admin applies a template in the
 * New Appointment Drawer it is expanded into normal booking lines and then
 * forgotten; the template is never linked persistently to a booking.
 *
 * Deliberately separate from {@link ClientPackageAssignment} (a live, per-client
 * instance) and from ServiceOption.isPackage (the public Occasioni catalog), so a
 * template has NO query path to the public page and can never leak there.
 */
@Entity
@Table(name = "recurring_package_template")
@Getter
@Setter
@NoArgsConstructor
public class RecurringPackageTemplate {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false, columnDefinition = "TEXT")
    private String name;

    /** Suggested whole-package price; seeds the form but stays editable. */
    @Column(name = "default_price", precision = 10, scale = 2)
    private BigDecimal defaultPrice;

    /** Suggested per-session duration in minutes; seeds the form but stays editable. */
    @Column(name = "default_duration_min")
    private Integer defaultDurationMin;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Soft-delete marker. An archived template disappears from the drawer picker
     * but stays in the table for audit. Hard delete is never used.
     */
    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    /**
     * Composition items (1..N descriptive lines).
     * Setter suppressed so the collection reference stays Hibernate-managed —
     * use addItem / clearItems / replaceItems to mutate.
     */
    @Setter(AccessLevel.NONE)
    @OneToMany(mappedBy = "template", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    private List<RecurringPackageTemplateItem> items = new ArrayList<>();

    public void addItem(RecurringPackageTemplateItem item) {
        item.setTemplate(this);
        this.items.add(item);
    }

    public void clearItems() {
        for (RecurringPackageTemplateItem i : this.items) {
            i.setTemplate(null);
        }
        this.items.clear();
    }

    public void replaceItems(List<RecurringPackageTemplateItem> newItems) {
        clearItems();
        if (newItems != null) {
            for (RecurringPackageTemplateItem i : newItems) {
                addItem(i);
            }
        }
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
