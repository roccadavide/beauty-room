package daviderocca.beautyroom.packages;

import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.repositories.ServiceItemRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * CRUD for admin recurring package templates. A template is a pure recipe:
 * applying it happens in the booking flow (frontend expands items into normal
 * booking lines), so this service never touches bookings, sessions or payments.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecurringPackageTemplateService {

    private final RecurringPackageTemplateRepository templateRepo;
    private final ServiceOptionRepository serviceOptionRepo;
    private final ServiceItemRepository serviceItemRepo;

    // ── Create ──────────────────────────────────────────────────────────────────

    @Transactional
    public RecurringPackageTemplateDTO create(RecurringPackageTemplateRequestDTO req) {
        RecurringPackageTemplate template = new RecurringPackageTemplate();
        applyScalarFields(template, req);
        for (RecurringPackageTemplateItem it : buildItemsFromRequestList(req.items())) {
            template.addItem(it);
        }
        log.info("ADMIN | create recurring package template '{}' ({} items)", req.name(), req.items().size());
        return toDTO(templateRepo.save(template));
    }

    // ── Read ────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<RecurringPackageTemplateDTO> findAllActive() {
        return templateRepo.findByArchivedAtIsNullOrderByCreatedAtDesc()
                .stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public RecurringPackageTemplateDTO findById(UUID id) {
        return toDTO(requireTemplate(id));
    }

    // ── Update ──────────────────────────────────────────────────────────────────

    @Transactional
    public RecurringPackageTemplateDTO update(UUID id, RecurringPackageTemplateRequestDTO req) {
        RecurringPackageTemplate template = requireTemplate(id);
        applyScalarFields(template, req);
        template.replaceItems(buildItemsFromRequestList(req.items()));
        log.info("ADMIN | update recurring package template id={}", id);
        return toDTO(templateRepo.save(template));
    }

    // ── Archive (soft delete) ─────────────────────────────────────────────────────

    @Transactional
    public RecurringPackageTemplateDTO archive(UUID id) {
        RecurringPackageTemplate template = requireTemplate(id);
        if (template.getArchivedAt() == null) {
            template.setArchivedAt(LocalDateTime.now());
        }
        log.info("ADMIN | archive recurring package template id={}", id);
        return toDTO(templateRepo.save(template));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private void applyScalarFields(RecurringPackageTemplate template, RecurringPackageTemplateRequestDTO req) {
        template.setName(req.name().trim());
        template.setDefaultPrice(req.defaultPrice());
        template.setDefaultDurationMin(normalizePositive(req.defaultDurationMin()));
        template.setNotes(req.notes() != null ? req.notes().trim() : null);
    }

    private RecurringPackageTemplate requireTemplate(UUID id) {
        return templateRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RecurringPackageTemplate not found: " + id));
    }

    /**
     * Materialises composition items from request DTOs, sorted by position.
     * Mirrors ClientPackageService.buildItemsFromRequestList, plus the per-line
     * price/duration overrides this entity carries. Free-form lines without any
     * catalog reference are accepted as custom-only (the DB CHECK is the guard).
     */
    private List<RecurringPackageTemplateItem> buildItemsFromRequestList(List<RecurringPackageTemplateItemRequestDTO> reqs) {
        List<RecurringPackageTemplateItemRequestDTO> sorted = new ArrayList<>(reqs);
        sorted.sort(Comparator.comparingInt(RecurringPackageTemplateItemRequestDTO::position));
        List<RecurringPackageTemplateItem> built = new ArrayList<>(sorted.size());
        for (RecurringPackageTemplateItemRequestDTO it : sorted) {
            RecurringPackageTemplateItem entity = new RecurringPackageTemplateItem();
            entity.setPosition(it.position());

            if (it.serviceOptionId() != null) {
                ServiceOption opt = serviceOptionRepo.findById(it.serviceOptionId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "ServiceOption not found: " + it.serviceOptionId()));
                entity.setServiceOption(opt);
                ServiceItem svc = opt.getService();
                if (it.serviceId() != null) {
                    svc = serviceItemRepo.findById(it.serviceId())
                            .orElseThrow(() -> new ResourceNotFoundException(
                                    "ServiceItem not found: " + it.serviceId()));
                }
                entity.setService(svc);
            } else if (it.serviceId() != null) {
                ServiceItem svc = serviceItemRepo.findById(it.serviceId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "ServiceItem not found: " + it.serviceId()));
                entity.setService(svc);
            }

            if (it.customName() != null && !it.customName().isBlank()) {
                entity.setCustomName(it.customName().trim());
            }

            entity.setPriceOverride(it.priceOverride());
            entity.setDurationOverrideMin(normalizePositive(it.durationOverrideMin()));

            built.add(entity);
        }
        return built;
    }

    private RecurringPackageTemplateDTO toDTO(RecurringPackageTemplate t) {
        List<RecurringPackageTemplateItemDTO> itemDTOs = t.getItems() == null
                ? List.of()
                : t.getItems().stream()
                        .sorted(Comparator.comparingInt(RecurringPackageTemplateItem::getPosition))
                        .map(this::toItemDTO)
                        .toList();
        return new RecurringPackageTemplateDTO(
                t.getId(),
                t.getName(),
                t.getDefaultPrice(),
                t.getDefaultDurationMin(),
                t.getNotes(),
                t.getCreatedAt(),
                t.getUpdatedAt(),
                itemDTOs
        );
    }

    private RecurringPackageTemplateItemDTO toItemDTO(RecurringPackageTemplateItem it) {
        ServiceItem svc = it.getService();
        if (svc == null && it.getServiceOption() != null) {
            svc = it.getServiceOption().getService();
        }
        return new RecurringPackageTemplateItemDTO(
                it.getId(),
                svc != null ? svc.getServiceId() : null,
                svc != null ? svc.getTitle() : null,
                it.getServiceOption() != null ? it.getServiceOption().getOptionId() : null,
                it.getServiceOption() != null ? it.getServiceOption().getName() : null,
                it.getCustomName(),
                it.getPosition(),
                it.getPriceOverride(),
                it.getDurationOverrideMin()
        );
    }

    private static Integer normalizePositive(Integer value) {
        if (value == null) return null;
        return value > 0 ? value : null;
    }
}
