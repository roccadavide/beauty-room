package daviderocca.beautyroom.packages;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RecurringPackageTemplateRepository extends JpaRepository<RecurringPackageTemplate, UUID> {

    /** Active (non-archived) templates for the drawer picker, newest first. */
    List<RecurringPackageTemplate> findByArchivedAtIsNullOrderByCreatedAtDesc();
}
