package daviderocca.beautyroom.email.templates;

import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PackageSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PromoLineSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PromoSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.SaleSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.ServiceSummaryDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.services.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Builds the presentation-ready {@link BookingEmailModel} for the multi-item booking
 * emails. The single source of truth for a booking's contents is
 * {@link BookingService#assembleBookingCard(Booking)} — the SAME assembler the admin
 * agenda card uses. The totals here mirror the frontend agenda formula
 * (AdminAgendaPage.buildBreakdownItems + computeBookingAmountDue) so the email's
 * "amount due" matches the agenda exactly.
 *
 * <p>Composition rules confirmed in STEP 0:
 * <ul>
 *   <li>Promo services live ONLY in the promotion-link snapshot, package services are
 *       removed from {@code booking_services} (V56) — so {@code card.services()},
 *       {@code linkedPromotions} and {@code linkedPackages} are disjoint; no de-dup needed.</li>
 *   <li>A promo's {@code totalDiscounted} already includes its tagged products
 *       (PricingUtils discounts the whole bundle) — so a promo contributes its
 *       {@code totalDiscounted}, never its product lines summed separately.</li>
 *   <li>Packages are rendered as a {@link PackageBlock} (never a priced line); their cost
 *       is carried by the authoritative amount-due / payment label.</li>
 *   <li>{@code customTotalPrice} (when set) is the services-side bundle: show per-line
 *       list prices + a reconciling "Sconto" line; products always add on top.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class BookingEmailAssembler {

    private final BookingService bookingService;

    private static final DateTimeFormatter IT_TIME =
            DateTimeFormatter.ofPattern("HH:mm", Locale.ITALY);
    private static final DateTimeFormatter IT_DATE =
            DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.ITALY);
    private static final DateTimeFormatter IT_DATE_SHORT =
            DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ITALY);

    /** Fetch the card and build the model. Must run inside the worker's REQUIRES_NEW tx. */
    public BookingEmailModel toModel(Booking b, boolean reminder) {
        AdminBookingCardDTO card = bookingService.assembleBookingCard(b);
        return buildModel(card, b, reminder);
    }

    /** Internal economic line — mirrors buildBreakdownItems for amount-due parity. */
    private record Item(BigDecimal price, String kind, boolean settled) {}

    /** Pure card → model mapping (no DB). Visible for render/unit tests. */
    public BookingEmailModel buildModel(AdminBookingCardDTO card, Booking b, boolean reminder) {
        boolean paidOnline = card.paidOnline();
        boolean creditBacked = card.packageCreditId() != null; // online prepaid package session

        boolean hasCustom = Boolean.TRUE.equals(card.isCustomService())
                && card.customServiceName() != null && !card.customServiceName().isBlank();
        boolean showCustom = card.customServicePrice() != null || hasCustom;

        List<PackageSummaryDTO> pkgs = !card.linkedPackages().isEmpty()
                ? card.linkedPackages()
                : (card.linkedPackage() != null ? List.of(card.linkedPackage()) : List.of());

        // PATCH 3b: a package-session REMINDER carries NO price/amount-due at all (only the
        // package block + session info). Online prepaid sessions already hide prices on both
        // confirmation and reminder. Confirmations (reminder == false) are unaffected.
        boolean isPackageSession = creditBacked || !pkgs.isEmpty();
        boolean hidePrices = creditBacked || (reminder && isPackageSession);

        // ---------- economic items (for amount-due, mirrors buildBreakdownItems) ----------
        List<Item> items = new ArrayList<>();
        for (PackageSummaryDTO p : pkgs) {
            items.add(new Item(p.sessionPrice(), "package", paidOnline || creditBacked || p.paid()));
        }
        for (ServiceSummaryDTO s : card.services()) {
            items.add(new Item(s.price(), "extra", paidOnline || creditBacked || s.paid()));
        }
        if (showCustom) {
            items.add(new Item(card.customServicePrice(), "custom",
                    paidOnline || creditBacked || card.customServicePaid()));
        }
        for (PromoSummaryDTO promo : card.linkedPromotions()) {
            items.add(new Item(promo.totalDiscounted(), "promotion",
                    paidOnline || creditBacked || promo.paid()));
        }
        for (SaleSummaryDTO sale : card.linkedSales()) {
            items.add(new Item(lineTotal(sale), "sale", sale.paid())); // products: own flag only
        }
        boolean legacyFallback = items.isEmpty(); // single-service booking with no booking_services rows
        if (legacyFallback) {
            items.add(new Item(legacyPrice(card, b), "legacy", paidOnline || creditBacked));
        }

        boolean isBundle = card.customTotalPrice() != null;
        BigDecimal amountDue = computeAmountDue(items, isBundle, card.customTotalPrice());

        // ---------- display sections ----------
        List<EmailSection> sections = new ArrayList<>();

        // Trattamento(i): catalog services + custom line (+ legacy single-service fallback)
        List<EmailLine> treat = new ArrayList<>();
        BigDecimal servicesGross = BigDecimal.ZERO;
        for (ServiceSummaryDTO s : card.services()) {
            servicesGross = servicesGross.add(nz(s.price()));
            treat.add(new EmailLine(serviceLabel(s), null, money(s.price(), hidePrices), null));
        }
        if (showCustom) {
            servicesGross = servicesGross.add(nz(card.customServicePrice()));
            treat.add(new EmailLine(
                    hasCustom ? card.customServiceName() : "Servizio personalizzato",
                    null, money(card.customServicePrice(), hidePrices), null));
        }
        if (treat.isEmpty() && legacyFallback && pkgs.isEmpty() && !creditBacked
                && card.serviceTitle() != null) {
            BigDecimal price = legacyPrice(card, b);
            servicesGross = servicesGross.add(nz(price));
            String label = card.serviceTitle()
                    + (card.optionName() != null ? " · " + card.optionName() : "");
            treat.add(new EmailLine(label, null, money(price, hidePrices), null));
        }
        if (!treat.isEmpty()) {
            sections.add(new EmailSection(treat.size() > 1 ? "Trattamenti" : "Trattamento", treat));
        }

        // Promozione · <title> per linked promotion (0..N)
        BigDecimal promosGross = BigDecimal.ZERO;
        for (PromoSummaryDTO promo : card.linkedPromotions()) {
            promosGross = promosGross.add(nz(promo.totalDiscounted()));
            List<EmailLine> lines = new ArrayList<>();
            for (PromoLineSummaryDTO sl : promo.services()) {
                lines.add(new EmailLine(sl.name(), null,
                        money(sl.discountedPrice(), hidePrices),
                        strike(sl.originalPrice(), sl.discountedPrice(), hidePrices)));
            }
            for (PromoLineSummaryDTO pl : promo.products()) {
                lines.add(new EmailLine(pl.name(), null,
                        money(pl.discountedPrice(), hidePrices),
                        strike(pl.originalPrice(), pl.discountedPrice(), hidePrices)));
            }
            sections.add(new EmailSection(
                    "Promozione · " + (promo.title() != null ? promo.title() : "Promozione"), lines));
        }

        // Prodotti: standalone product sales (promotion_link_id IS NULL)
        BigDecimal salesGross = BigDecimal.ZERO;
        List<EmailLine> prod = new ArrayList<>();
        for (SaleSummaryDTO sale : card.linkedSales()) {
            BigDecimal line = lineTotal(sale);
            salesGross = salesGross.add(nz(line));
            int qty = sale.quantity() <= 0 ? 1 : sale.quantity();
            String meta = qty > 1 ? "Qt. " + qty + " · " + money(sale.unitPrice(), false) + " cad." : null;
            prod.add(new EmailLine(
                    sale.productName() != null ? sale.productName() : "Prodotto",
                    meta, money(line, hidePrices), null));
        }
        if (!prod.isEmpty()) sections.add(new EmailSection("Prodotti", prod));

        // ---------- panel total + reconciling discount (visible lines only) ----------
        BigDecimal beforeProducts = isBundle ? nz(card.customTotalPrice()) : servicesGross;
        beforeProducts = beforeProducts.add(promosGross);
        BigDecimal panelTotal = beforeProducts.add(salesGross);
        BigDecimal discount = isBundle ? servicesGross.subtract(nz(card.customTotalPrice())) : BigDecimal.ZERO;

        String discountLabel = null, discountStr = null;
        if (!hidePrices && discount.signum() > 0) {
            discountLabel = "Sconto";
            discountStr = "−" + money(discount, false); // − formatted amount
        }
        String totalLabel = null, totalStr = null;
        if (!hidePrices && !sections.isEmpty() && panelTotal.signum() > 0) {
            totalLabel = "Totale";
            totalStr = money(panelTotal, false);
        }

        // ---------- package block ----------
        PackageBlock packageBlock = buildPackageBlock(card, b, pkgs, reminder, creditBacked);

        // ---------- payment label (authoritative amount due) ----------
        String paymentLabel;
        if (creditBacked) {
            paymentLabel = "Incluso nel pacchetto (già pagato)";
        } else if (reminder && isPackageSession) {
            // PATCH 3b: admin package-session reminder — never show an amount due.
            // "Già pagato" only when every linked package is actually settled
            // (assignment.paidUpfront || link.paid, folded into PackageSummaryDTO.paid());
            // otherwise no money line at all.
            boolean covered = !pkgs.isEmpty() && pkgs.stream().allMatch(PackageSummaryDTO::paid);
            paymentLabel = covered ? "Già pagato" : null;
        } else if (paidOnline) {
            paymentLabel = "Già pagato online";
        } else if (amountDue.signum() <= 0) {
            paymentLabel = "Già pagato";
        } else {
            paymentLabel = "Da saldare in studio: " + money(amountDue, false);
        }

        // ---------- when / duration range ----------
        LocalDateTime start = card.startTime();
        String whenDate = start != null ? cap(start.format(IT_DATE)) : "-";
        String whenTime = start != null ? start.format(IT_TIME) : "-";
        String durationRange = durationRange(card, b);

        return new BookingEmailModel(
                card.customerName(), card.customerEmail(),
                whenDate, whenTime, durationRange,
                sections,
                discountLabel, discountStr,
                totalLabel, totalStr,
                paymentLabel,
                packageBlock);
    }

    /** Mirrors AdminAgendaPage.computeBookingAmountDue (bundle = lockstep non-sale unit). */
    private BigDecimal computeAmountDue(List<Item> items, boolean isBundle, BigDecimal bundle) {
        BigDecimal saleDue = items.stream()
                .filter(i -> "sale".equals(i.kind()) && !i.settled())
                .map(i -> nz(i.price())).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (!isBundle) {
            return items.stream().filter(i -> !i.settled())
                    .map(i -> nz(i.price())).reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        boolean bundleUnpaid = items.stream().anyMatch(i -> !"sale".equals(i.kind()) && !i.settled());
        return (bundleUnpaid ? nz(bundle) : BigDecimal.ZERO).add(saleDue);
    }

    private PackageBlock buildPackageBlock(AdminBookingCardDTO card, Booking b,
                                           List<PackageSummaryDTO> pkgs, boolean reminder, boolean creditBacked) {
        // Online prepaid package session (PackageCredit) — never in linkedPackages.
        if (creditBacked && b != null && b.getPackageCredit() != null) {
            PackageCredit pc = b.getPackageCredit();
            int total = pc.getSessionsTotal();
            int remaining = pc.getSessionsRemaining();
            String svc = pc.getServiceOption() != null ? pc.getServiceOption().getName()
                    : (pc.getService() != null ? pc.getService().getTitle() : "trattamento");
            String headline = "Pacchetto: " + total + " " + sedute(total) + " di " + svc
                    + (!reminder && pc.getExpiryDate() != null
                        ? ", valido fino al " + pc.getExpiryDate().format(IT_DATE_SHORT) : "");
            String sessionInfo = total + " " + sedute(total) + " · " + remaining + " rimanenti";
            return new PackageBlock(headline, sessionInfo, true);
        }
        // Admin/in-person package (ClientPackageAssignment via BookingPackageLink). No expiry exists.
        if (!pkgs.isEmpty()) {
            PackageSummaryDTO p = pkgs.get(0);
            String name = p.packageName() != null ? p.packageName() : "trattamento";
            String headline = "Pacchetto: " + p.totalSessions() + " " + sedute(p.totalSessions()) + " di " + name;
            String sessionInfo = p.sessionNumber() > 0
                    ? "Seduta " + p.sessionNumber() + " di " + p.totalSessions()
                        + " · ne " + (p.sessionsRemaining() == 1 ? "resta " : "restano ") + p.sessionsRemaining()
                    : p.totalSessions() + " " + sedute(p.totalSessions()) + " · " + p.sessionsRemaining() + " rimanenti";
            return new PackageBlock(headline, sessionInfo, p.paid());
        }
        return null;
    }

    private String durationRange(AdminBookingCardDTO card, Booking b) {
        LocalDateTime start = card.startTime();
        if (start == null) return null;
        Integer dur = (b != null && b.getDurationMinutes() != null) ? b.getDurationMinutes() : null;
        if (dur == null && card.endTime() != null) {
            dur = (int) Duration.between(start, card.endTime()).toMinutes();
        }
        if (dur == null || dur <= 0) return null;
        LocalDateTime end = start.plusMinutes(dur);
        return start.format(IT_TIME) + "–" + end.format(IT_TIME) + " circa · ~" + dur + " min";
    }

    // ---------------- small helpers ----------------

    private static BigDecimal lineTotal(SaleSummaryDTO sale) {
        if (sale.unitPrice() == null) return null;
        int qty = sale.quantity() <= 0 ? 1 : sale.quantity();
        return sale.unitPrice().multiply(BigDecimal.valueOf(qty));
    }

    private static BigDecimal legacyPrice(AdminBookingCardDTO card, Booking b) {
        if (card.optionPrice() != null) return card.optionPrice();
        return (b != null && b.getService() != null) ? b.getService().getPrice() : null;
    }

    private static String serviceLabel(ServiceSummaryDTO s) {
        String name = s.name() != null ? s.name() : "Trattamento";
        return (s.optionName() != null && !s.optionName().isBlank()) ? name + " · " + s.optionName() : name;
    }

    private static String sedute(int n) {
        return n == 1 ? "seduta" : "sedute";
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    /** Italian-grouped euro (€ 1.200,00). Returns null when hidden or value missing. */
    private static String money(BigDecimal v, boolean hide) {
        if (hide || v == null) return null;
        return "€ " + String.format(Locale.ITALY, "%,.2f", v.setScale(2, RoundingMode.HALF_UP));
    }

    private static String strike(BigDecimal original, BigDecimal discounted, boolean hide) {
        if (hide || original == null || discounted == null) return null;
        return original.compareTo(discounted) > 0 ? money(original, false) : null;
    }

    private static String cap(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
