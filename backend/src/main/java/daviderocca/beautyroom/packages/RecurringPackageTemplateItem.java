package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One descriptive line of a recurring package template composition.
 * A pointer to either a catalog service, a catalog service+option, or a
 * free-form custom line, plus optional per-line price/duration overrides that
 * seed the appointment when the template is applied.
 *
 * FK references to services/options use ON DELETE SET NULL (see V64): if a
 * service is later hard-deleted the template degrades gracefully to its
 * custom_name instead of breaking.
 */
@Entity
@Table(name = "recurring_package_template_item")
@Getter
@Setter
@NoArgsConstructor
public class RecurringPackageTemplateItem {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private RecurringPackageTemplate template;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private ServiceItem service;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_option_id")
    private ServiceOption serviceOption;

    @Column(name = "custom_name", length = 255)
    private String customName;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "price_override", precision = 10, scale = 2)
    private BigDecimal priceOverride;

    @Column(name = "duration_override_min")
    private Integer durationOverrideMin;
}
