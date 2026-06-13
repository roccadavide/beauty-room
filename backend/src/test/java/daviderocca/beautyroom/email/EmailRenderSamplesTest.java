package daviderocca.beautyroom.email;

import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCardDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PackageSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PromoLineSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.PromoSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.SaleSummaryDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.ServiceSummaryDTO;
import daviderocca.beautyroom.email.templates.BookingEmailAssembler;
import daviderocca.beautyroom.email.templates.BookingEmailModel;
import daviderocca.beautyroom.email.templates.EmailContent;
import daviderocca.beautyroom.email.templates.EmailTemplateService;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Order;
import daviderocca.beautyroom.entities.OrderItem;
import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.ClientPackagePaymentMode;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Renders the four representative multi-item booking emails to /tmp for visual review.
 * Pure unit test — no Spring context, no DB. Exercises the REAL composition + total
 * logic via {@link BookingEmailAssembler#buildModel} (the only part skipped is the DB
 * fetch in toModel), then renders the templates.
 */
class EmailRenderSamplesTest {

    private final BookingEmailAssembler asm = new BookingEmailAssembler(null); // buildModel doesn't use the service

    @Test
    void renderSamples() throws Exception {
        EmailTemplateService t = brandedTemplate();

        LocalDateTime start = LocalDateTime.of(2026, 6, 15, 13, 30);

        // (a) 2 services (one with option) + 1 product, pay-in-store, unpaid
        AdminBookingCardDTO cardA = card(b -> {
            b.start = start; b.end = start.plusMinutes(50);
            b.name = "Giulia Bianchi"; b.email = "giulia@example.com";
            b.services = List.of(
                    new ServiceSummaryDTO(UUID.randomUUID(), "Manicure", 30, bd("25.00"), null, null, null, null, false),
                    new ServiceSummaryDTO(UUID.randomUUID(), "Laser", 20, bd("80.00"), UUID.randomUUID(), "Ascelle", null, null, false));
            b.sales = List.of(new SaleSummaryDTO(UUID.randomUUID(), UUID.randomUUID(), "Crema viso lenitiva", 1, bd("30.00"), false));
        });
        BookingEmailModel mA = asm.buildModel(cardA, null, false);
        EmailContent a = t.bookingConfirmed(mA);
        write("a-confirmed-2services-product", a);
        assertTrue(a.html().contains("€ 135,00"), "grand total 135");
        assertTrue(a.html().contains("Laser · Ascelle"), "option label");
        assertTrue(a.html().contains("13:30–14:20 circa · ~50 min"), "duration range");
        assertTrue(a.html().contains("Da saldare in studio: € 135,00"), "payment due");

        // (b) promo booking, unpaid
        AdminBookingCardDTO cardB = card(b -> {
            b.start = start; b.end = start.plusMinutes(90);
            b.name = "Marta Verdi"; b.email = "marta@example.com";
            b.promos = List.of(new PromoSummaryDTO(
                    UUID.randomUUID(), UUID.randomUUID(), "Rituale Sposa", "PERCENTAGE", bd("20"),
                    bd("200.00"), bd("160.00"), false, true,
                    List.of(new PromoLineSummaryDTO(UUID.randomUUID(), "Manicure", bd("40.00"), bd("32.00"), 30),
                            new PromoLineSummaryDTO(UUID.randomUUID(), "Trucco sposa", bd("160.00"), bd("128.00"), 60)),
                    List.of()));
        });
        BookingEmailModel mB = asm.buildModel(cardB, null, false);
        EmailContent eb = t.bookingConfirmed(mB);
        write("b-confirmed-promo", eb);
        assertTrue(eb.html().contains("Promozione · Rituale Sposa"), "promo section");
        assertTrue(eb.html().contains("€ 160,00"), "promo total");
        assertTrue(eb.html().contains("line-through"), "struck original");

        // (c) package reminder (admin) — "Seduta X di N"
        AdminBookingCardDTO cardC = card(b -> {
            b.start = start; b.end = start.plusMinutes(30);
            b.name = "Sara Neri"; b.email = "sara@example.com";
            b.linkedPackages = List.of(new PackageSummaryDTO(
                    UUID.randomUUID(), "Laser ascelle", 3, 6, 3, bd("50.00"), false,
                    List.of(), false, false, null, ClientPackagePaymentMode.PER_SESSION));
        });
        BookingEmailModel mC = asm.buildModel(cardC, null, true);
        EmailContent c = t.bookingReminder(mC);
        write("c-reminder-package-admin", c);
        assertTrue(c.html().contains("Pacchetto: 6 sedute di Laser ascelle"), "pkg headline");
        assertTrue(c.html().contains("Seduta 3 di 6 · ne restano 3"), "session progress");
        // PATCH 3b: a package-session reminder shows NO price / amount-due at all.
        assertTrue(!c.html().contains("Da saldare"), "reminder package: no amount-due label");
        assertTrue(!c.html().contains("€ 50,00"), "reminder package: no price");
        assertTrue(!c.html().contains("Totale"), "reminder package: no total row");

        // (c2) same admin package reminder but MARKED PAID → "Già pagato", still no price
        AdminBookingCardDTO cardC2 = card(x -> {
            x.start = start; x.end = start.plusMinutes(30);
            x.name = "Sara Neri"; x.email = "sara@example.com";
            x.linkedPackages = List.of(new PackageSummaryDTO(
                    UUID.randomUUID(), "Laser ascelle", 4, 6, 2, bd("50.00"), false,
                    List.of(), true, false, null, ClientPackagePaymentMode.PER_SESSION)); // paid = true
        });
        EmailContent c2 = t.bookingReminder(asm.buildModel(cardC2, null, true));
        write("c2-reminder-package-admin-paid", c2);
        assertTrue(c2.html().contains("Già pagato"), "paid reminder shows Già pagato");
        assertTrue(!c2.html().contains("Da saldare"), "paid reminder: no amount-due");
        assertTrue(!c2.html().contains("€ 50,00"), "paid reminder: no price");

        // (d) package confirmation (online, prepaid) — covered, no price
        AdminBookingCardDTO cardD = card(b -> {
            b.start = start; b.end = start.plusMinutes(30);
            b.name = "Elena Russo"; b.email = "elena@example.com";
            b.serviceTitle = "Laser ascelle";
            b.packageCreditId = UUID.randomUUID();
            b.sessionsRemaining = 5; b.sessionsTotal = 5;
        });
        Booking bookingD = new Booking();
        bookingD.setStartTime(start);
        bookingD.setDurationMinutes(30);
        bookingD.setPackageCredit(packageCredit());
        BookingEmailModel mD = asm.buildModel(cardD, bookingD, false);
        EmailContent d = t.bookingConfirmed(mD);
        write("d-confirmed-package-online", d);
        assertTrue(d.html().contains("valido fino al 12 giu 2028"), "validity");
        assertTrue(d.html().contains("✓ Incluso nel pacchetto"), "covered tag");
        assertTrue(d.html().contains("Incluso nel pacchetto (già pagato)"), "covered payment label");

        // (d1) PROMPT C+D: online package PURCHASE (rank 1) — unified "Seduta X di N" + amount paid.
        // Shows "Seduta 1 di 5 · ne restano 4 · pagato € 250,00" + "valido fino al …".
        AdminBookingCardDTO cardD1 = card(b -> {
            b.start = start; b.end = start.plusMinutes(30);
            b.name = "Elena Russo"; b.email = "elena@example.com";
            b.serviceTitle = "Laser ascelle";
            b.packageCreditId = UUID.randomUUID();
            b.sessionsRemaining = 4; b.sessionsTotal = 5;
        });
        Booking bookingD1 = new Booking();
        bookingD1.setStartTime(start);
        bookingD1.setDurationMinutes(30);
        bookingD1.setPackageCredit(packageCreditOnline(5, 4));
        EmailContent d1 = t.bookingConfirmed(asm.buildModel(cardD1, bookingD1, false, 1));
        write("d1-confirmed-package-online-purchase", d1);
        assertTrue(d1.html().contains("Seduta 1 di 5 · ne restano 4"), "rank 1 session line");
        assertTrue(d1.html().contains("pagato € 250,00"), "rank 1 shows amount paid");
        assertTrue(d1.html().contains("valido fino al 12 giu 2028"), "validity");
        assertTrue(d1.html().contains("Incluso nel pacchetto (già pagato)"), "covered payment label");
        assertTrue(d1.html().contains("15 giugno 2026"), "first-session date in when block");

        // (d2) PROMPT C+D: online package LATER session (rank 3, booked by Michela in agenda) —
        // "Seduta 3 di 5 · ne restano 2", NO amount (only the purchase shows what was paid).
        AdminBookingCardDTO cardD2 = card(b -> {
            b.start = start; b.end = start.plusMinutes(30);
            b.name = "Elena Russo"; b.email = "elena@example.com";
            b.serviceTitle = "Laser ascelle";
            b.packageCreditId = UUID.randomUUID();
            b.sessionsRemaining = 2; b.sessionsTotal = 5;
        });
        Booking bookingD2 = new Booking();
        bookingD2.setStartTime(start);
        bookingD2.setDurationMinutes(30);
        bookingD2.setPackageCredit(packageCreditOnline(5, 2));
        EmailContent d2 = t.bookingConfirmed(asm.buildModel(cardD2, bookingD2, false, 3));
        write("d2-confirmed-package-online-session3", d2);
        assertTrue(d2.html().contains("Seduta 3 di 5 · ne restano 2"), "rank 3 session line");
        assertTrue(!d2.html().contains("pagato €"), "later session shows NO amount");

        // (e) bundle (customTotalPrice) → per-line list prices + reconciling Sconto, products on top
        AdminBookingCardDTO cardE = card(x -> {
            x.start = start; x.end = start.plusMinutes(60);
            x.name = "Chiara Galli"; x.email = "chiara@example.com";
            x.services = List.of(
                    new ServiceSummaryDTO(UUID.randomUUID(), "Pulizia viso", 30, bd("45.00"), null, null, null, null, false),
                    new ServiceSummaryDTO(UUID.randomUUID(), "Massaggio relax", 30, bd("60.00"), null, null, null, null, false));
            x.customTotalPrice = bd("90.00");   // bundle: 105 list → 90 paid
            x.sales = List.of(new SaleSummaryDTO(UUID.randomUUID(), UUID.randomUUID(), "Olio corpo", 1, bd("30.00"), false));
        });
        BookingEmailModel mE = asm.buildModel(cardE, null, false);
        EmailContent ee = t.bookingConfirmed(mE);
        write("e-confirmed-bundle-sconto", ee);
        assertTrue(ee.html().contains("Sconto"), "discount label");
        assertTrue(ee.html().contains("−€ 15,00"), "discount amount");
        assertTrue(ee.html().contains("€ 120,00"), "bundle total + product");
        assertTrue(ee.html().contains("Da saldare in studio: € 120,00"), "bundle due");

        // (h) PROMPT E: single service + whole-appointment custom price (€30 list → €25) → the
        // line shows the custom amount, NO list price, NO "Sconto"; the product adds on top.
        AdminBookingCardDTO cardH = card(x -> {
            x.start = start; x.end = start.plusMinutes(45);
            x.name = "Anna Conti"; x.email = "anna@example.com";
            x.services = List.of(
                    new ServiceSummaryDTO(UUID.randomUUID(), "Pulizia viso", 45, bd("30.00"), null, null, null, null, false));
            x.customTotalPrice = bd("25.00");   // single service: charge €25 instead of the €30 list price
            x.sales = List.of(new SaleSummaryDTO(UUID.randomUUID(), UUID.randomUUID(), "Siero vitamina C", 1, bd("20.00"), false));
        });
        BookingEmailModel mH = asm.buildModel(cardH, null, false);
        EmailContent eh = t.bookingConfirmed(mH);
        write("h-confirmed-single-custom-price", eh);
        assertTrue(eh.html().contains("€ 25,00"), "single-service line shows the custom price");
        assertTrue(!eh.html().contains("Sconto"), "no reconciling discount for a single service");
        assertTrue(!eh.html().contains("€ 30,00"), "the €30 list price is not shown");
        assertTrue(eh.html().contains("€ 45,00"), "total = €25 service + €20 product");
        assertTrue(eh.html().contains("Da saldare in studio: € 45,00"), "amount due = custom total + product");

        System.out.println("\n=== Rendered email samples ===");
        for (String f : List.of("a-confirmed-2services-product", "b-confirmed-promo",
                "c-reminder-package-admin", "d-confirmed-package-online",
                "d1-confirmed-package-online-purchase", "d2-confirmed-package-online-session3",
                "e-confirmed-bundle-sconto", "h-confirmed-single-custom-price")) {
            System.out.println("  /tmp/beautyroom-email-" + f + ".html");
        }
    }

    /** PROMPT A: neutral refund-confirmed emails (booking + order) — no "slot occupato" wording. */
    @Test
    void renderRefundConfirmedSamples() throws Exception {
        EmailTemplateService t = brandedTemplate();
        LocalDateTime start = LocalDateTime.of(2026, 6, 15, 13, 30);

        // (f) booking refund CONFIRMED — paid-online 2-service booking, full refund → amount = paid total
        AdminBookingCardDTO cardF = card(b -> {
            b.start = start; b.end = start.plusMinutes(50);
            b.name = "Giulia Bianchi"; b.email = "giulia@example.com";
            b.paidOnline = true;
            b.services = List.of(
                    new ServiceSummaryDTO(UUID.randomUUID(), "Manicure", 30, bd("25.00"), null, null, null, null, true),
                    new ServiceSummaryDTO(UUID.randomUUID(), "Laser", 20, bd("80.00"), UUID.randomUUID(), "Ascelle", null, null, true));
        });
        EmailContent fref = t.bookingRefundConfirmed(asm.buildModel(cardF, null, false));
        write("f-booking-refund-confirmed", fref);
        assertTrue(fref.html().contains("Importo rimborsato"), "amount label");
        assertTrue(fref.html().contains("€ 105,00"), "refund amount = paid total");
        assertTrue(fref.html().contains("Manicure · Laser · Ascelle"), "appointment service summary");
        assertTrue(!fref.html().contains("occupato"), "no slot-taken wording");
        assertTrue(!fref.html().contains("Non confermata"), "no slot-taken wording");

        // (g) order refund CONFIRMED — total mirrors orderPaid (price × qty)
        Order order = new Order();
        order.setCustomerName("Francesca");
        order.setCustomerSurname("Mauri");
        order.setCustomerEmail("francesca@example.com");
        setObj(order, "orderId", UUID.fromString("a1b2c3d4-1111-2222-3333-444455556666"));
        Product p1 = new Product(); p1.setName("Crema viso lenitiva");
        Product p2 = new Product(); p2.setName("Detergente delicato");
        order.setOrderItems(List.of(
                new OrderItem(1, bd("30.00"), p1, null),
                new OrderItem(2, bd("18.50"), p2, null)));
        EmailContent gref = t.orderRefundConfirmed(order);
        write("g-order-refund-confirmed", gref);
        assertTrue(gref.html().contains("Importo rimborsato"), "amount label");
        // euro() glues € to the number with a non-breaking space in HTML (as orderPaid does);
        // assert the numeric part to stay space-agnostic. The .txt twin uses a regular space.
        assertTrue(gref.html().contains("67,00"), "order refund amount (30 + 2×18.50)");
        assertTrue(gref.text().contains("€ 67,00"), "order refund amount in text twin");
        assertTrue(gref.html().contains("#A1B2C3D4"), "order number");
        assertTrue(!gref.html().contains("occupato"), "no slot wording");

        System.out.println("\n=== Rendered refund-confirmed email samples ===");
        System.out.println("  /tmp/beautyroom-email-f-booking-refund-confirmed.html");
        System.out.println("  /tmp/beautyroom-email-g-order-refund-confirmed.html");
    }

    /** PROMPT B: appuntamento spostato (Prima→Ora) + annullato. */
    @Test
    void renderRescheduledAndCancelledSamples() throws Exception {
        EmailTemplateService t = brandedTemplate();
        LocalDateTime oldStart = LocalDateTime.of(2026, 6, 15, 13, 30);
        LocalDateTime newStart = LocalDateTime.of(2026, 6, 18, 16, 0);

        // (i) moved: 2-service booking, 15 giu 13:30 → 18 giu 16:00 (previous persisted)
        AdminBookingCardDTO cardMoved = card(b -> {
            b.start = newStart; b.end = newStart.plusMinutes(50);
            b.name = "Giulia Bianchi"; b.email = "giulia@example.com";
            b.services = List.of(
                    new ServiceSummaryDTO(UUID.randomUUID(), "Manicure", 30, bd("25.00"), null, null, null, null, false),
                    new ServiceSummaryDTO(UUID.randomUUID(), "Laser", 20, bd("80.00"), UUID.randomUUID(), "Ascelle", null, null, false));
        });
        Booking bMoved = new Booking();
        bMoved.setStartTime(newStart);
        bMoved.setDurationMinutes(50);
        bMoved.setPreviousStartTime(oldStart);
        EmailContent moved = t.bookingRescheduled(asm.buildModel(cardMoved, bMoved, false));
        write("i-booking-rescheduled", moved);
        assertTrue(moved.html().contains("Spostato"), "h1");
        assertTrue(moved.html().contains(">Prima<"), "previous label present");
        assertTrue(moved.html().contains("line-through"), "previous struck");
        assertTrue(moved.html().contains("15 giugno 2026"), "previous date");
        assertTrue(moved.html().contains("18 giugno 2026"), "new date");
        assertTrue(moved.html().contains("Manicure"), "service summary");
        assertTrue(!moved.html().contains("€"), "moved email shows no prices");
        assertTrue(moved.text().contains("Prima:") && moved.text().contains("Ora:"), "text twin from→to");

        // (i2) moved with NO previous persisted → only the new date/time, no "Prima" row
        EmailContent movedNoPrev = t.bookingRescheduled(asm.buildModel(cardMoved, null, false));
        write("i2-booking-rescheduled-noprev", movedNoPrev);
        assertTrue(!movedNoPrev.html().contains(">Prima<"), "no previous label when previousStartTime null");
        assertTrue(movedNoPrev.html().contains("18 giugno 2026"), "new date still shown");

        // (j) cancelled: generic, no price, no reason
        AdminBookingCardDTO cardCancel = card(b -> {
            b.start = oldStart; b.end = oldStart.plusMinutes(45);
            b.name = "Marta Verdi"; b.email = "marta@example.com";
            b.services = List.of(
                    new ServiceSummaryDTO(UUID.randomUUID(), "Pulizia viso", 45, bd("45.00"), null, null, null, null, false));
        });
        EmailContent cancelled = t.bookingCancelled(asm.buildModel(cardCancel, null, false));
        write("j-booking-cancelled", cancelled);
        assertTrue(cancelled.html().contains("Annullato"), "h1");
        assertTrue(cancelled.html().contains("15 giugno 2026"), "appointment date");
        assertTrue(cancelled.html().contains("Pulizia viso"), "service summary");
        assertTrue(!cancelled.html().contains("€"), "no price");

        System.out.println("\n=== Rendered reschedule/cancel email samples ===");
        for (String f : List.of("i-booking-rescheduled", "i2-booking-rescheduled-noprev", "j-booking-cancelled")) {
            System.out.println("  /tmp/beautyroom-email-" + f + ".html");
        }
    }

    // ---------- helpers ----------

    private static PackageCredit packageCredit() {
        ServiceItem svc = new ServiceItem();
        svc.setTitle("Laser ascelle");
        PackageCredit pc = new PackageCredit();
        pc.setSessionsTotal(5);
        pc.setSessionsRemaining(5);
        pc.setExpiryDate(LocalDateTime.of(2028, 6, 12, 0, 0));
        pc.setService(svc);
        return pc;
    }

    // Online package credit WITH the service option set — option.price is exactly what Stripe
    // charged for the package (BookingCheckoutController :150, full price, not × sessions), so the
    // rank-1 purchase email can show "pagato € …".
    private static PackageCredit packageCreditOnline(int total, int remaining) {
        ServiceItem svc = new ServiceItem();
        svc.setTitle("Laser ascelle");
        ServiceOption opt = new ServiceOption();
        opt.setName("Laser ascelle");
        opt.setPrice(new BigDecimal("250.00"));
        opt.setSessions(total);
        PackageCredit pc = new PackageCredit();
        pc.setSessionsTotal(total);
        pc.setSessionsRemaining(remaining);
        pc.setExpiryDate(LocalDateTime.of(2028, 6, 12, 0, 0));
        pc.setService(svc);
        pc.setServiceOption(opt);
        return pc;
    }

    private static BigDecimal bd(String v) { return new BigDecimal(v); }

    private void write(String name, EmailContent c) throws Exception {
        Files.writeString(Path.of("/tmp/beautyroom-email-" + name + ".html"), c.html());
        Files.writeString(Path.of("/tmp/beautyroom-email-" + name + ".txt"), c.text());
    }

    // Mutable holder so each sample sets only what it needs; the rest defaults.
    private static final class C {
        LocalDateTime start, end;
        String name = "Cliente", email = "cliente@example.com", serviceTitle = null, optionName = null;
        BigDecimal optionPrice = null, customTotalPrice = null, customServicePrice = null;
        Boolean isCustomService = false;
        String customServiceName = null;
        UUID packageCreditId = null;
        Integer sessionsRemaining = null, sessionsTotal = null;
        boolean paidOnline = false, customServicePaid = false;
        List<ServiceSummaryDTO> services = List.of();
        List<PackageSummaryDTO> linkedPackages = List.of();
        List<PromoSummaryDTO> promos = List.of();
        List<SaleSummaryDTO> sales = List.of();
    }

    private interface Cfg { void apply(C c); }

    private static AdminBookingCardDTO card(Cfg cfg) {
        C c = new C();
        cfg.apply(c);
        return new AdminBookingCardDTO(
                UUID.randomUUID(), c.start, c.end, BookingStatus.CONFIRMED,
                c.name, "+39 333 1234567", c.email,
                c.serviceTitle, null, c.optionName, null, null, c.optionPrice, null,
                c.packageCreditId, c.sessionsRemaining, c.sessionsTotal, null,
                c.paidOnline ? "cs_test_123" : null, 0,
                false, false, null,
                c.services, c.isCustomService, c.customServiceName, null, c.customServicePrice,
                c.customTotalPrice, null, null, null, null,
                c.linkedPackages.isEmpty() ? null : c.linkedPackages.get(0), c.linkedPackages,
                false, c.customServicePaid, c.paidOnline ? c.start : null, c.paidOnline, false, null,
                false, c.promos, c.sales, true, false);
    }

    private static EmailTemplateService brandedTemplate() throws Exception {
        EmailTemplateService t = new EmailTemplateService();
        set(t, "frontUrl", "https://beauty-room.it");
        set(t, "brandName", "Beauty Room");
        set(t, "brandAddress", "Viale Risorgimento 587, Calusco d'Adda (BG)");
        set(t, "brandPhoneLabel", "+39 378 092 1723");
        set(t, "brandPhoneE164", "+393780921723");
        set(t, "brandEmail", "rossimichela.pmu@gmail.com");
        set(t, "brandVat", "04837370164");
        set(t, "instagramUrl", "https://www.instagram.com/rossimichela.pmu");
        set(t, "facebookUrl", "https://www.facebook.com/rossimichela.pmu");
        set(t, "googleReviewUrl", "https://g.page/r/PLACEHOLDER/review");
        return t;
    }

    private static void set(Object target, String field, String value) throws Exception {
        Field f = target.getClass().getDeclaredField(field);
        f.setAccessible(true);
        f.set(target, value);
    }

    // Order.orderId is @Setter(AccessLevel.NONE) — set it reflectively for a realistic sample.
    private static void setObj(Object target, String field, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(field);
        f.setAccessible(true);
        f.set(target, value);
    }
}
