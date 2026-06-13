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
import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.enums.BookingStatus;
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
                    List.of(), false, false, null));
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
                    List.of(), true, false, null)); // paid = true
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

        System.out.println("\n=== Rendered email samples ===");
        for (String f : List.of("a-confirmed-2services-product", "b-confirmed-promo",
                "c-reminder-package-admin", "d-confirmed-package-online", "e-confirmed-bundle-sconto")) {
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
}
