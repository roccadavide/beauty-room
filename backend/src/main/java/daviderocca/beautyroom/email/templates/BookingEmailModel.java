package daviderocca.beautyroom.email.templates;

import java.util.List;

/**
 * Presentation-ready model for the multi-item booking emails (confirmation + reminder).
 * Built by {@link BookingEmailAssembler} from the admin agenda card so emails total a
 * booking exactly like the agenda. All monetary fields are already formatted strings.
 *
 * - durationRange → "13:30–13:50 circa · ~20 min" (null when no start/duration)
 * - discountLabel/discountStr → present only when a reconciling "Sconto" line is needed
 * - totalLabel/totalStr → null when there is nothing priced to total (covered/empty panel)
 * - paymentLabel → "Già pagato online" / "Da saldare in studio: € X" / "Incluso nel pacchetto (già pagato)"
 * - packageBlock → null when the booking is not part of a package
 */
public record BookingEmailModel(
        String customerName, String customerEmail,
        String whenDate, String whenTime, String durationRange,
        List<EmailSection> sections,
        String discountLabel, String discountStr,
        String totalLabel, String totalStr,
        String paymentLabel,
        PackageBlock packageBlock
) {}
