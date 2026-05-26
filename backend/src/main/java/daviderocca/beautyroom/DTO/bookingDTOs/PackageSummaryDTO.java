package daviderocca.beautyroom.DTO.bookingDTOs;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Summary of a ClientPackageAssignment attached to a booking.
 * <p>
 * {@code sessionNumber} is THIS booking's position in the package (from the
 * {@link daviderocca.beautyroom.packages.BookingPackageLink}'s sessionNumber column),
 * and {@code totalSessions} is the assignment's total. Together they let the agenda
 * card render "Seduta X/Y" per linked package — Phase 5a/5b made the booking carry
 * N links, Phase 6 needs each link's own counter rather than the FIRST-link
 * back-compat values exposed on the booking root.
 * <p>
 * {@code sessionsRemaining} is the assignment's live counter (shared across all links
 * of that assignment). {@code sessionPrice} is the catalog per-session price (option
 * price if the package targets a specific option, else the underlying service's price),
 * zeroed by the Phase 5a paidUpfront rule so prepaid sessions don't double-count in
 * the day's estimated revenue KPI. Null when no usable price exists.
 * <p>
 * {@code paidUpfront} mirrors {@code ClientPackageAssignment.paidUpfront} so the
 * agenda card can mark a prepaid package on the booking row (Phase 6b "Pagato"
 * pill). Already drives the {@code sessionPrice = 0} rule on the backend — now
 * exposed verbatim so the UI can render it.
 * <p>
 * {@code items} exposes the full multi-line composition. Descriptive only; never
 * empty after migration V59 (invariant: every package has >= 1 composition item).
 */
public record PackageSummaryDTO(
        UUID packageAssignmentId,
        String packageName,
        int sessionNumber,
        int totalSessions,
        int sessionsRemaining,
        BigDecimal sessionPrice,
        boolean paidUpfront,
        List<PackageItemSummaryDTO> items,
        // V62: effective settled state for THIS session.
        // paid = link.paid OR assignment.paidUpfront.
        boolean paid,
        // True when settlement is not editable in the drawer
        // (paidUpfront — the whole package is prepaid).
        boolean paidLocked,
        // V62 / Problem 6: dynamic reference to the package's notes.
        // Read live from ClientPackageAssignment.notes — editing the package
        // note propagates to every linked session on next render.
        String notes
) {}
