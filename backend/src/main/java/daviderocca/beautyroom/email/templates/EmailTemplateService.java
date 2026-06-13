package daviderocca.beautyroom.email.templates;

import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Order;
import daviderocca.beautyroom.entities.OrderItem;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.entities.WaitlistEntry;
import daviderocca.beautyroom.enums.PaymentMethod;
import daviderocca.beautyroom.enums.WishlistItemType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Transactional email templates — presentation layer (v2).
 * Visual spec: email-design-reference.html (approved). Light is the inline default;
 * dark mode is delivered via the prefers-color-scheme @media block in HEAD, so every
 * coloured element carries BOTH an inline light value AND a class for the dark override.
 * Pure white/black are avoided (Apple Mail inverts them).
 */
@Service
public class EmailTemplateService {

    @Value("${app.frontend.url:https://beauty-room.it}")
    private String frontUrl;

    // Dati brand configurabili
    @Value("${app.brand.name:Beauty Room}")
    private String brandName;

    @Value("${app.brand.address:Viale Risorgimento 587, Calusco d'Adda (BG)}")
    private String brandAddress;

    @Value("${app.brand.phone:+39 378 092 1723}")
    private String brandPhoneLabel;

    @Value("${app.brand.phoneE164:+393780921723}")
    private String brandPhoneE164;

    @Value("${app.brand.email:rossimichela.pmu@gmail.com}")
    private String brandEmail;

    @Value("${app.brand.vat:04837370164}")
    private String brandVat;

    @Value("${app.brand.instagramUrl:https://www.instagram.com/rossimichela.pmu}")
    private String instagramUrl;

    @Value("${app.brand.facebookUrl:https://www.facebook.com/rossimichela.pmu}")
    private String facebookUrl;

    @Value("${app.google.review.url:https://g.page/r/PLACEHOLDER/review}")
    private String googleReviewUrl;

    private static final String SERIF = "'Cormorant Garamond','Petrona',Georgia,'Times New Roman',serif";
    private static final String SANS  = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    private static final DateTimeFormatter IT_DT =
            DateTimeFormatter.ofPattern("EEE dd MMM yyyy, HH:mm", Locale.ITALY);
    private static final DateTimeFormatter IT_DATE =
            DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.ITALY);
    private static final DateTimeFormatter IT_DATE_SHORT =
            DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.ITALY);
    private static final DateTimeFormatter IT_TIME =
            DateTimeFormatter.ofPattern("HH:mm", Locale.ITALY);

    // ===================== BOOKING CONFIRMED =====================
    // v3: multi-item. Fed by BookingEmailAssembler (mirrors the admin agenda card),
    // so the email shows every service/option/product/promo/package + an authoritative
    // total and the correct payment label.
    public EmailContent bookingConfirmed(BookingEmailModel m) {
        String subject = "Prenotazione confermata · " + brandName;
        String preheader = "Ti confermo il tuo appuntamento da Beauty Room ✦";

        String customerName = safe(m.customerName());
        String viewUrl = frontUrl + "/area-personale";

        String inner = heroRow("La tua prenotazione", "Confermata")
                + introRow("Ciao " + inkB(customerName) + ", ti confermo il tuo appuntamento da Beauty&nbsp;Room. "
                        + "Ti aspetto: qui sotto trovi tutti i dettagli.")
                + ornamentRow()
                + whenRangeRow(m.whenDate(), m.whenTime(), m.durationRange())
                + pricedPanelRow(m)
                + packageBlockRow(m.packageBlock())
                + paymentRow(m.paymentLabel())
                + labeledLineRow("Dove", brandAddress, false)
                + kvRow("Email di conferma", safe(m.customerEmail()))
                + buttonRow("Visualizza prenotazione", viewUrl)
                + helperRow("Devi spostare o modificare l'appuntamento? Scrivimi, ci penso io.")
                + contactPillsRow()
                + signoffRow("Grazie di avermi scelto.<br>Non vedo l'ora di prendermi cura di te.");

        String html = wrap(preheader, inner);
        String text = bookingText("Prenotazione confermata",
                "Ciao " + customerName + ", ti confermo il tuo appuntamento da Beauty Room. Ti aspetto.", m);

        return new EmailContent(subject, html, text);
    }

    // ===================== BOOKING REMINDER =====================
    public EmailContent bookingReminder(BookingEmailModel m) {
        String subject = "Promemoria appuntamento · " + brandName;
        String preheader = "Promemoria appuntamento da Beauty Room ✦";

        String customerName = safe(m.customerName());

        String inner = heroRow("Promemoria", "Ti aspetto")
                + introRow("Ciao " + inkB(customerName) + ", ti ricordo il tuo appuntamento da Beauty&nbsp;Room.")
                + ornamentRow()
                + whenRangeRow(m.whenDate(), m.whenTime(), m.durationRange())
                + pricedPanelRow(m)
                + packageBlockRow(m.packageBlock())
                + paymentRow(m.paymentLabel())
                + labeledLineRow("Dove", brandAddress, false)
                + helperRow("Hai un imprevisto e vuoi spostare? Scrivimi il prima possibile.")
                + contactPillsRow()
                + signoffRow("Grazie di avermi scelto.<br>Non vedo l'ora di prendermi cura di te.");

        String html = wrap(preheader, inner);
        String text = bookingText("Promemoria appuntamento",
                "Ciao " + customerName + ", ti ricordo il tuo appuntamento da Beauty Room.", m);

        return new EmailContent(subject, html, text);
    }

    // ===================== ORDER PAID =====================
    public EmailContent orderPaid(Order o) {
        String subject = "Ordine confermato · " + brandName;
        String preheader = "Ordine confermato: ti aspetto per il ritiro ✦";

        String firstName = (o.getCustomerName() != null && !o.getCustomerName().isBlank())
                ? o.getCustomerName().trim().split("\\s+")[0]
                : "cara cliente";
        String fullName = ((o.getCustomerName() == null ? "" : o.getCustomerName()) + " "
                + (o.getCustomerSurname() == null ? "" : o.getCustomerSurname())).trim();
        if (fullName.isBlank()) fullName = firstName;

        boolean isPis = o.getPaymentMethod() == PaymentMethod.PAY_IN_STORE;

        // Righe articoli + totale (dati correnti: getOrderItems)
        BigDecimal total = BigDecimal.ZERO;
        StringBuilder items = new StringBuilder();
        StringBuilder itemsText = new StringBuilder();
        List<OrderItem> valid = new ArrayList<>();
        if (o.getOrderItems() != null) {
            for (OrderItem it : o.getOrderItems()) {
                if (it != null && it.getPrice() != null && it.getProduct() != null) valid.add(it);
            }
        }
        for (int i = 0; i < valid.size(); i++) {
            OrderItem it = valid.get(i);
            BigDecimal line = it.getPrice().multiply(BigDecimal.valueOf(it.getQuantity()));
            total = total.add(line);
            String name = safe(it.getProduct().getName());
            String meta = "Qt. " + it.getQuantity() + " · " + euro(it.getPrice()) + " cad.";
            items.append(itemRow(name, meta, euro(line), i == valid.size() - 1));
            itemsText.append("  - ").append(name).append(" x").append(it.getQuantity())
                    .append(" = ").append(euroPlain(line)).append("\n");
        }

        String totalLabel = isPis ? "Da saldare al ritiro" : "Pagato online";
        String whenPaid = (o.getPaidAt() != null) ? o.getPaidAt().format(IT_DT) : "-";
        String orderId = (o.getOrderId() != null)
                ? "#" + o.getOrderId().toString().toUpperCase().substring(0, 8) : "-";

        String pickupNote = (o.getPickupNote() != null && !o.getPickupNote().isBlank())
                ? o.getPickupNote() : null;
        String ritiroMain = pickupNote != null
                ? pickupNote
                : (isPis ? "Ritiro e pagamento in studio" : "Ti avviso appena è pronto per il ritiro");

        String inner = heroRow("Il tuo ordine", "Confermato")
                + introRow("Ciao " + inkB(firstName) + ", ho ricevuto il tuo ordine. "
                        + "Ecco cosa hai scelto e quando potrai ritirarlo.")
                + ornamentRow()
                + panelRow("14px 40px 0", "Articoli", items.toString(), totalLabel, euro(total))
                + ritiroRow(ritiroMain, brandAddress)
                + kvRow("Numero ordine", orderId)
                + kvRow(isPis ? "Consegna" : "Pagato il", isPis ? "Al ritiro" : whenPaid)
                + kvRow("Email di conferma", safe(o.getCustomerEmail()))
                + buttonRow("I miei ordini", frontUrl + "/ordini")
                + helperRow("Vuoi sapere quando è pronto? Scrivimi su WhatsApp.")
                + contactPillsRow()
                + signoffRow("Grazie di avermi scelto.<br>Non vedo l'ora di prendermi cura di te.");

        String html = wrap(preheader, inner);

        String text = """
                Ordine confermato · %s

                Ciao %s (%s), ho ricevuto il tuo ordine.

                Numero ordine: %s
                %s: %s

                Articoli:
                %s
                %s: %s

                Ritiro: %s
                %s
                WhatsApp: https://wa.me/%s

                Grazie di avermi scelto. Non vedo l'ora di prendermi cura di te.
                """.formatted(
                brandName, firstName, fullName,
                orderId,
                isPis ? "Consegna" : "Pagato il", isPis ? "Al ritiro" : whenPaid,
                itemsText, totalLabel, euroPlain(total),
                ritiroMain, brandAddress, waNum());

        return new EmailContent(subject, html, text);
    }

    // ===================== PAID CONFLICT ALERT (ADMIN) =====================
    public EmailContent paidConflictAlert(Booking b, String stripeSessionId) {
        String subject = "⚠️ PAID_CONFLICT — Prenotazione pagata su slot già occupato";
        String preheader = "Azione richiesta: rimborso manuale su Stripe";

        String when = (b.getStartTime() != null) ? b.getStartTime().format(IT_DT) : "-";
        String customerName = safe(b.getCustomerName());
        String bookingId = b.getBookingId() != null ? b.getBookingId().toString() : "-";
        String sessionId = (stripeSessionId != null && !stripeSessionId.isBlank()) ? stripeSessionId : "-";

        String inner = heroRow("Avviso interno", "Slot occupato")
                + introRow("Si è verificato un " + inkB("PAID_CONFLICT")
                        + " su una prenotazione pagata con Stripe.")
                + detailsPanelRow(new String[][]{
                        {"Booking ID", bookingId},
                        {"Cliente", customerName},
                        {"Data / ora", when},
                        {"Stripe Session", sessionId}
                })
                + helperRow("Azione richiesta: effettua manualmente il rimborso su Stripe e "
                        + "contatta la cliente per fissare un nuovo appuntamento.");

        String html = wrap(preheader, inner);

        String text = """
                ⚠️ PAID_CONFLICT — Prenotazione pagata su slot già occupato

                Booking ID: %s
                Cliente: %s
                Data/ora: %s
                Stripe Session: %s

                Azione richiesta: effettua manualmente il rimborso su Stripe
                e contatta la cliente per fissare un nuovo appuntamento.
                """.formatted(bookingId, customerName, when, sessionId);

        return new EmailContent(subject, html, text);
    }

    // ===================== BOOKING REFUNDED (FIX-6) =====================
    public EmailContent bookingRefunded(Booking b) {
        String subject = "Rimborso in arrivo · " + brandName;
        String preheader = "La tua prenotazione non è stata confermata · rimborso in arrivo";

        String when = (b.getStartTime() != null) ? b.getStartTime().format(IT_DT) : "-";
        String serviceTitle = safe(b.getService() != null ? b.getService().getTitle() : null);
        String customerName = safe(b.getCustomerName());
        String customerEmail = safe(b.getCustomerEmail());

        String inner = heroRow("La tua prenotazione", "Non confermata")
                + introRow("Ciao " + inkB(customerName) + ", mi dispiace dirti che la tua prenotazione non è stata "
                        + "confermata: lo slot era già stato occupato. Il pagamento verrà rimborsato "
                        + "automaticamente entro 5–10 giorni lavorativi.")
                + detailsPanelRow(new String[][]{
                        {"Trattamento", serviceTitle},
                        {"Data / ora prenotata", when},
                        {"Email", customerEmail}
                })
                + helperRow("Scrivimi per fissare un nuovo appuntamento, mi spiace per l'inconveniente.")
                + contactPillsRow();

        String html = wrap(preheader, inner);

        String text = """
                Rimborso in arrivo · %s

                Ciao %s, mi dispiace dirti che la tua prenotazione non è stata confermata:
                lo slot era già stato occupato. Il pagamento verrà rimborsato automaticamente
                entro 5-10 giorni lavorativi.

                Trattamento: %s
                Data/ora: %s

                Scrivimi per fissare un nuovo appuntamento, mi spiace per l'inconveniente.
                WhatsApp: https://wa.me/%s
                """.formatted(brandName, customerName, serviceTitle, when, waNum());

        return new EmailContent(subject, html, text);
    }

    // ===================== USER REGISTERED (admin notification) =====================
    public EmailContent userRegistered(User u) {
        String subject = "Nuova registrazione · " + brandName;
        String preheader = "Una nuova cliente si è registrata";

        String fullName = (safe(u.getName()) + " " + safe(u.getSurname())).trim();
        String email = safe(u.getEmail());
        String phone = safe(u.getPhone());

        String inner = heroRow("Gestione clienti", "Nuova cliente")
                + introRow("Una nuova cliente si è appena registrata su " + inkB(brandName) + ".")
                + detailsPanelRow(new String[][]{
                        {"Nome", fullName},
                        {"Email", email},
                        {"Telefono", phone}
                })
                + helperRow("Puoi verificarla come Cliente di Fiducia dal pannello Gestione → Account.");

        String html = wrap(preheader, inner);

        String text = """
                Nuova registrazione · %s

                Una nuova cliente si è appena registrata.
                Nome: %s
                Email: %s
                Telefono: %s

                Puoi verificarla come Cliente di Fiducia dal pannello Gestione.
                """.formatted(brandName, fullName, email, phone);

        return new EmailContent(subject, html, text);
    }

    // ===================== WAITLIST SLOT AVAILABLE =====================
    public EmailContent waitlistSlotAvailable(WaitlistEntry entry, String bookingLink) {
        String subject = "Slot disponibile · prenota adesso — " + brandName;
        String preheader = "Si è liberato uno slot per te ✦";

        String firstName = entry.getCustomerName() != null
                ? entry.getCustomerName().trim().split("\\s+")[0] : "cara cliente";
        String serviceTitle = entry.getService() != null
                ? entry.getService().getTitle() : "il tuo trattamento";
        String dateStr = cap(entry.getRequestedDate().format(IT_DATE_SHORT));
        String timeStr = entry.getRequestedTime().toString().substring(0, 5);

        String inner = heroRow("Lista d'attesa", "Si è liberato")
                + introRow("Ciao " + inkB(firstName) + ", ottima notizia: si è liberato uno slot per "
                        + inkB(serviceTitle) + ".")
                + whenRow(dateStr, timeStr)
                + buttonRow("Prenota adesso", bookingLink)
                + helperRow("Hai <b>2 ore</b> per completare la prenotazione, poi lo slot passa alla "
                        + "persona successiva in lista.")
                + helperRow("Se non sei più interessata, ignora pure questa email.")
                + contactPillsRow();

        String html = wrap(preheader, inner);

        String text = """
                Slot disponibile · %s

                Ciao %s, si è liberato uno slot per %s.

                Quando: %s, ore %s

                Prenota adesso (link riservato, valido 2 ore):
                %s

                Se non sei più interessata, ignora pure questa email.
                """.formatted(brandName, firstName, serviceTitle, dateStr, timeStr, bookingLink);

        return new EmailContent(subject, html, text);
    }

    // ===================== REVIEW REQUEST =====================
    public EmailContent reviewRequest(Booking b) {
        String subject = "Com'è andata? ⭐ · " + brandName;
        String preheader = "Mi piacerebbe sapere come ti sei trovata ✦";

        String firstName = b.getCustomerName() != null
                ? b.getCustomerName().trim().split("\\s+")[0] : "cara cliente";
        String serviceTitle = b.getService() != null
                ? b.getService().getTitle() : "il tuo trattamento";

        String inner = heroRow("Il tuo parere", "Com'è andata?")
                + starsRow()
                + introRow("Ciao " + inkB(firstName) + ", grazie di avermi scelto per " + inkB(serviceTitle)
                        + ". Il tuo parere conta tanto e aiuta altre persone a trovarmi.")
                + helperRow("Se ti sei trovata bene, mi farebbe felice leggere una tua recensione — bastano due minuti.")
                + buttonRow("Lascia una recensione", googleReviewUrl)
                + helperRow("Se invece c'è qualcosa che posso migliorare, rispondi a questa email: "
                        + "leggo personalmente ogni messaggio.");

        String html = wrap(preheader, inner);

        String text = """
                Com'è andata? · %s

                Ciao %s, grazie di avermi scelto per %s.
                Il tuo parere conta tanto e aiuta altre persone a trovarmi.

                Se ti sei trovata bene, lascia una recensione (bastano due minuti):
                %s

                Se invece c'è qualcosa che posso migliorare, rispondi a questa email:
                leggo personalmente ogni messaggio.
                """.formatted(brandName, firstName, serviceTitle, googleReviewUrl);

        return new EmailContent(subject, html, text);
    }

    // ===================== PRODUCT BACK IN STOCK =====================
    public EmailContent productBackInStock(String customerName, String productName,
                                           String productUrl, String email) {
        String safeCustomer = safe(customerName);
        String safeProduct = safe(productName);
        String subject = "\"" + safeProduct + "\" è di nuovo disponibile · " + brandName;
        String preheader = "Il prodotto che aspettavi è tornato disponibile ✦";

        String inner = heroRow("Torna disponibile", "Buone notizie")
                + introRow("Ciao " + inkB(safeCustomer) + ", il prodotto che aspettavi è di nuovo "
                        + "disponibile in studio.")
                + detailsPanelRow(new String[][]{
                        {"Prodotto", safeProduct},
                        {"Studio", brandName},
                        {"Dove", brandAddress}
                })
                + buttonRow("Acquista ora", productUrl)
                + helperRow("Gli articoli vanno a ruba — ti consiglio di non aspettare troppo.");

        String html = wrap(preheader, inner);

        String text = """
                "%s" è di nuovo disponibile · %s

                Ciao %s, il prodotto che aspettavi è di nuovo disponibile in studio.
                Acquista ora: %s

                Gli articoli vanno a ruba, ti consiglio di non aspettare troppo.
                """.formatted(safeProduct, brandName, safeCustomer, productUrl);

        return new EmailContent(subject, html, text);
    }

    // ===================== WISHLIST BACK IN STOCK =====================
    public EmailContent wishlistBackInStock(User user, String itemName, WishlistItemType itemType, String itemUrl) {
        String firstName = (user.getName() != null && !user.getName().isBlank())
                ? user.getName() : "cara cliente";

        String typeLabel = switch (itemType) {
            case SERVICE   -> "trattamento";
            case PRODUCT   -> "prodotto";
            case PROMOTION -> "promozione";
            case PACKAGE   -> "pacchetto";
        };

        String subject = "✦ " + safe(itemName) + " è di nuovo disponibile";
        String preheader = "Un preferito della tua wishlist è tornato ✦";

        String inner = heroRow("Dalla tua wishlist", "Di nuovo disponibile")
                + introRow("Ciao " + inkB(firstName) + ", il " + inkB(typeLabel) + " che hai salvato nella "
                        + "wishlist è di nuovo disponibile. Non aspettare troppo: potrebbe esaurirsi di nuovo.")
                + detailsPanelRow(new String[][]{
                        {cap(typeLabel), safe(itemName)}
                })
                + buttonRow("Scopri di più", itemUrl)
                + helperRow("Se non ti interessa più, puoi rimuoverlo dalla wishlist dal tuo profilo.");

        String html = wrap(preheader, inner);

        String text = """
                ✦ %s è di nuovo disponibile · %s

                Ciao %s, il %s che hai salvato nella wishlist è di nuovo disponibile.
                Non aspettare troppo: potrebbe esaurirsi di nuovo.
                Scopri di più: %s
                """.formatted(safe(itemName), brandName, firstName, typeLabel, itemUrl);

        return new EmailContent(subject, html, text);
    }

    // ===================== LAYOUT SKELETON =====================

    private static final String HEAD = """
            <!DOCTYPE html><html lang="it"><head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="x-apple-disable-message-reformatting">
            <meta name="color-scheme" content="light dark">
            <meta name="supported-color-schemes" content="light dark">
            <!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Petrona:wght@400;500&display=swap" rel="stylesheet"><!--<![endif]-->
            <style>
              @media only screen and (max-width:620px){
                .br-container{ width:100% !important; }
                .br-pad{ padding-left:22px !important; padding-right:22px !important; }
                .br-h1{ font-size:34px !important; }
                .br-hero-pad{ padding:34px 22px 8px !important; }
              }
              @media (prefers-color-scheme: dark){
                .br-canvas{ background:#1f1915 !important; }
                .br-card{ background:#2a221c !important; border-color:#473a2c !important; }
                .br-panel{ background:#241d18 !important; border-color:#473a2c !important; }
                .br-ink{ color:#f3ebdd !important; }
                .br-body{ color:#d9cdbd !important; }
                .br-muted{ color:#b3a692 !important; }
                .br-hair{ border-color:#473a2c !important; }
                .br-rowhair{ border-color:#3a3024 !important; }
                .br-gold{ color:#d8b884 !important; }
                .br-pill{ background:#241d18 !important; border-color:#52432f !important; color:#f3ebdd !important; }
                .br-btn{ background:#f3ebdd !important; color:#2a221c !important; border-color:#d8b884 !important; }
                .br-footer-ink{ color:#e9e0d2 !important; }
              }
            </style>
            </head>
            <body style="margin:0;padding:0;">
            """;

    private static final String CANVAS_OPEN =
            "<table role=\"presentation\" class=\"br-canvas\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"background:#efe7da;margin:0;\">"
            + "<tr><td align=\"center\" style=\"padding:30px 14px 34px;\">"
            + "<table role=\"presentation\" class=\"br-container\" width=\"600\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"width:600px;max-width:600px;\">";

    private static final String CARD_OPEN =
            "<tr><td class=\"br-card\" style=\"background:#fffdf9;border:1px solid #e7dbca;border-radius:20px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">";

    private static final String CARD_CLOSE = "</table></td></tr>";
    private static final String CANVAS_CLOSE = "</table></td></tr></table>";

    private String wrap(String preheader, String inner) {
        return HEAD
                + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">" + esc(preheader) + "</div>"
                + CANVAS_OPEN
                + headerBar()
                + CARD_OPEN
                + inner
                + CARD_CLOSE
                + footer()
                + CANVAS_CLOSE
                + "</body></html>";
    }

    private String headerBar() {
        String wordmark = esc(brandName).replace(" ", "&nbsp;");
        return "<tr><td align=\"center\" style=\"padding:6px 0 22px;\">"
                + "<div class=\"br-gold\" style=\"font-family:" + SERIF + ";font-size:15px;color:#b8976a;\">✦</div>"
                + "<div class=\"br-ink\" style=\"font-family:" + SERIF + ";font-weight:500;font-size:30px;letter-spacing:1.5px;color:#3a2e27;margin-top:2px;\">" + wordmark + "</div>"
                + "<div class=\"br-muted\" style=\"font-family:" + SANS + ";font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9c8c7d;margin-top:9px;\">Trucco permanente&nbsp;·&nbsp;Laser&nbsp;·&nbsp;Estetica avanzata</div>"
                + "</td></tr>";
    }

    private String footer() {
        String wordmark = esc(brandName).replace(" ", "&nbsp;");
        String waNum = waNum();
        return "<tr><td align=\"center\" class=\"br-pad\" style=\"padding:26px 24px 6px;\">"
                + "<div class=\"br-footer-ink\" style=\"font-family:" + SERIF + ";font-size:18px;letter-spacing:1px;color:#5a4d44;\">" + wordmark + "</div>"
                + "<div class=\"br-muted\" style=\"font-family:" + SANS + ";font-size:12px;line-height:1.85;color:#9c8c7d;margin-top:8px;\">"
                + esc(brandAddress) + "<br>"
                + "<a href=\"tel:" + escAttr(brandPhoneE164) + "\" class=\"br-gold\" style=\"color:#8c6d3f;text-decoration:none;\">" + esc(brandPhoneLabel) + "</a>&nbsp;·&nbsp;"
                + "<a href=\"https://wa.me/" + waNum + "\" class=\"br-gold\" style=\"color:#8c6d3f;text-decoration:none;\">WhatsApp</a>&nbsp;·&nbsp;"
                + "<a href=\"mailto:" + escAttr(brandEmail) + "\" class=\"br-gold\" style=\"color:#8c6d3f;text-decoration:none;\">Email</a><br>"
                + "<a href=\"" + escAttr(instagramUrl) + "\" class=\"br-gold\" style=\"color:#8c6d3f;text-decoration:none;\">Instagram</a>&nbsp;·&nbsp;"
                + "<a href=\"" + escAttr(facebookUrl) + "\" class=\"br-gold\" style=\"color:#8c6d3f;text-decoration:none;\">Facebook</a>"
                + "</div>"
                + "<div class=\"br-muted\" style=\"font-family:" + SANS + ";font-size:10.5px;color:#9c8c7d;margin-top:14px;\">"
                + "P. IVA " + esc(brandVat) + " &nbsp;·&nbsp; © " + LocalDate.now().getYear() + " " + esc(brandName) + " — Tutti i diritti riservati"
                + "</div>"
                + "</td></tr>";
    }

    // ===================== ROW HELPERS =====================

    private String heroRow(String eyebrow, String h1) {
        return """
                <tr><td align="center" class="br-hero-pad" style="padding:40px 40px 8px;">
                  <div class="br-gold" style="font-family:%s;font-size:11px;letter-spacing:3.5px;text-transform:uppercase;color:#8c6d3f;font-weight:600;">%s</div>
                  <h1 class="br-ink br-h1" style="font-family:%s;font-weight:300;font-size:46px;line-height:1.06;color:#3a2e27;margin:12px 0 0;">%s</h1>
                </td></tr>
                """.formatted(SANS, esc(eyebrow), SERIF, esc(h1));
    }

    private String introRow(String html) {
        return """
                <tr><td class="br-pad" style="padding:18px 40px 4px;">
                  <p class="br-body" style="font-family:%s;font-size:15px;line-height:1.72;color:#574a41;margin:0;text-align:center;">%s</p>
                </td></tr>
                """.formatted(SANS, html);
    }

    private String ornamentRow() {
        return "<tr><td align=\"center\" style=\"padding:22px 0 4px;\">"
                + "<span class=\"br-gold\" style=\"font-family:" + SERIF + ";font-size:14px;color:#b8976a;letter-spacing:8px;\">✦&nbsp;✦&nbsp;✦</span>"
                + "</td></tr>";
    }

    private String starsRow() {
        return "<tr><td align=\"center\" class=\"br-pad\" style=\"padding:18px 40px 0;\">"
                + "<span class=\"br-gold\" style=\"font-family:" + SANS + ";font-size:24px;letter-spacing:8px;color:#b8976a;\">★★★★★</span>"
                + "</td></tr>";
    }

    private String whenRow(String dateStr, String timeStr) {
        return """
                <tr><td class="br-pad" style="padding:14px 40px 0;">
                  <div class="br-muted" style="font-family:%s;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#9c8c7d;font-weight:600;margin-bottom:8px;">Quando</div>
                  <div class="br-ink" style="font-family:%s;font-size:25px;color:#3a2e27;line-height:1.2;">%s</div>
                  <div class="br-body" style="font-family:%s;font-size:15px;color:#574a41;margin-top:4px;">Ore <b class="br-ink" style="color:#3a2e27;">%s</b></div>
                </td></tr>
                """.formatted(SANS, SERIF, esc(dateStr), SANS, esc(timeStr));
    }

    /** when + optional duration range ("13:30–13:50 circa · ~20 min"). */
    private String whenRangeRow(String dateStr, String timeStr, String durationRange) {
        String rangeLine = (durationRange == null || durationRange.isBlank()) ? ""
                : "<div class=\"br-muted\" style=\"font-family:" + SANS + ";font-size:13px;color:#9c8c7d;margin-top:7px;\">" + esc(durationRange) + "</div>";
        return """
                <tr><td class="br-pad" style="padding:14px 40px 0;">
                  <div class="br-muted" style="font-family:%s;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#9c8c7d;font-weight:600;margin-bottom:8px;">Quando</div>
                  <div class="br-ink" style="font-family:%s;font-size:25px;color:#3a2e27;line-height:1.2;">%s</div>
                  <div class="br-body" style="font-family:%s;font-size:15px;color:#574a41;margin-top:4px;">Ore <b class="br-ink" style="color:#3a2e27;">%s</b></div>
                  %s
                </td></tr>
                """.formatted(SANS, SERIF, esc(dateStr), SANS, esc(timeStr), rangeLine);
    }

    /** Multi-section priced panel (services / promo(s) / products) + optional Sconto + Totale. */
    private String pricedPanelRow(BookingEmailModel m) {
        if (m.sections().isEmpty() && m.totalStr() == null) return "";

        StringBuilder body = new StringBuilder();
        List<EmailSection> secs = m.sections();
        for (int si = 0; si < secs.size(); si++) {
            EmailSection sec = secs.get(si);
            body.append("<tr><td style=\"padding:").append(si == 0 ? "16px" : "14px")
                .append(" 18px 6px;\"><div class=\"br-gold\" style=\"font-family:").append(SANS)
                .append(";font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8c6d3f;font-weight:700;\">")
                .append(esc(sec.label())).append("</div></td></tr>");
            body.append("<tr><td style=\"padding:0 18px;\"><table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">");
            List<EmailLine> lines = sec.lines();
            for (int li = 0; li < lines.size(); li++) {
                body.append(emailLineRow(lines.get(li), li == lines.size() - 1));
            }
            body.append("</table></td></tr>");
        }

        StringBuilder totals = new StringBuilder();
        if (m.discountStr() != null) totals.append(totalLineRow(m.discountLabel(), m.discountStr(), false));
        if (m.totalStr() != null) totals.append(totalLineRow(m.totalLabel(), m.totalStr(), true));
        String totalsBlock = totals.length() == 0 ? ""
                : "<tr><td style=\"padding:6px 18px 16px;\"><table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">"
                + "<tr><td class=\"br-hair\" style=\"border-top:1px solid #e3d4c0;padding-top:12px;\">"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">"
                + totals + "</table></td></tr></table></td></tr>";

        return "<tr><td class=\"br-pad\" style=\"padding:22px 40px 0;\">"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" class=\"br-panel\" style=\"background:#faf5ec;border:1px solid #e7dbca;border-radius:14px;\">"
                + body + totalsBlock + "</table></td></tr>";
    }

    /** One panel line: name (+meta) left, price (+optional struck original) right. */
    private String emailLineRow(EmailLine line, boolean last) {
        String bb = last ? "" : "border-bottom:1px solid #ece0d0;";
        String cls = last ? "" : "br-rowhair";
        String metaSpan = (line.meta() == null || line.meta().isBlank()) ? ""
                : "<span class=\"br-muted\" style=\"font-family:" + SANS + ";font-size:12px;color:#9c8c7d;\">&nbsp;· " + esc(line.meta()) + "</span>";
        String priceCell;
        if (line.priceStr() == null || line.priceStr().isBlank()) {
            priceCell = "";
        } else {
            String strikeSpan = (line.strikeStr() == null || line.strikeStr().isBlank()) ? ""
                    : "<span class=\"br-muted\" style=\"font-family:" + SANS + ";font-size:12px;color:#9c8c7d;text-decoration:line-through;\">" + esc(line.strikeStr()) + "</span>&nbsp;&nbsp;";
            priceCell = strikeSpan + "<span class=\"br-gold\" style=\"font-family:" + SANS + ";font-size:15px;color:#8c6d3f;font-weight:700;\">" + esc(line.priceStr()) + "</span>";
        }
        return "<tr><td class=\"" + cls + "\" style=\"padding:9px 0;" + bb + "\"><span class=\"br-ink\" style=\"font-family:" + SANS + ";font-size:15px;color:#3a2e27;font-weight:600;\">" + esc(line.name()) + "</span>" + metaSpan + "</td>"
                + "<td align=\"right\" class=\"" + cls + "\" style=\"padding:9px 0;" + bb + "white-space:nowrap;\">" + priceCell + "</td></tr>";
    }

    /** A Sconto/Totale row inside the panel footer. big = the grand total. */
    private String totalLineRow(String label, String amount, boolean big) {
        String amtStyle = big
                ? "font-family:" + SANS + ";font-size:23px;color:#3a2e27;font-weight:700;"
                : "font-family:" + SANS + ";font-size:15px;color:#8c6d3f;font-weight:700;";
        String lblWeight = big ? "700" : "600";
        return "<tr><td><span class=\"br-muted\" style=\"font-family:" + SANS + ";font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9c8c7d;font-weight:" + lblWeight + ";\">" + esc(label) + "</span></td>"
                + "<td align=\"right\" style=\"white-space:nowrap;\"><span class=\"br-ink\" style=\"" + amtStyle + "\">" + esc(amount) + "</span></td></tr>";
    }

    /** Tinted package box (contextual; never a priced line). */
    private String packageBlockRow(PackageBlock pb) {
        if (pb == null) return "";
        String sub = (pb.sessionInfo() == null || pb.sessionInfo().isBlank()) ? ""
                : "<div class=\"br-body\" style=\"font-family:" + SANS + ";font-size:14px;color:#574a41;margin-top:5px;\">" + esc(pb.sessionInfo()) + "</div>";
        String coveredTag = pb.covered()
                ? "<div class=\"br-gold\" style=\"font-family:" + SANS + ";font-size:12px;color:#8c6d3f;font-weight:700;margin-top:8px;\">✓ Incluso nel pacchetto</div>"
                : "";
        return "<tr><td class=\"br-pad\" style=\"padding:18px 40px 0;\">"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" class=\"br-panel\" style=\"background:rgba(184,151,106,0.10);border:1px solid #e7dbca;border-radius:14px;\">"
                + "<tr><td style=\"padding:16px 18px;\">"
                + "<div class=\"br-ink\" style=\"font-family:" + SERIF + ";font-size:20px;color:#3a2e27;line-height:1.3;\">" + esc(pb.headline()) + "</div>"
                + sub + coveredTag
                + "</td></tr></table></td></tr>";
    }

    /** Payment-state line ("Già pagato online" / "Da saldare in studio: € X" / "Incluso..."). */
    private String paymentRow(String label) {
        if (label == null || label.isBlank()) return "";
        return "<tr><td class=\"br-pad\" style=\"padding:18px 40px 0;\">"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\"><tr>"
                + "<td><span class=\"br-muted\" style=\"font-family:" + SANS + ";font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9c8c7d;font-weight:600;\">Pagamento</span></td>"
                + "<td align=\"right\"><span class=\"br-ink\" style=\"font-family:" + SANS + ";font-size:14px;color:#3a2e27;font-weight:700;\">" + esc(label) + "</span></td>"
                + "</tr></table></td></tr>";
    }

    private String labeledLineRow(String label, String value, boolean serif) {
        String valStyle = serif
                ? "font-family:" + SERIF + ";font-size:21px;color:#3a2e27;line-height:1.25;"
                : "font-family:" + SANS + ";font-size:15px;color:#574a41;";
        String valClass = serif ? "br-ink" : "br-body";
        return """
                <tr><td class="br-pad" style="padding:20px 40px 0;">
                  <div class="br-muted" style="font-family:%s;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#9c8c7d;font-weight:600;margin-bottom:5px;">%s</div>
                  <div class="%s" style="%s">%s</div>
                </td></tr>
                """.formatted(SANS, esc(label), valClass, valStyle, esc(value));
    }

    private String kvRow(String label, String value) {
        return """
                <tr><td class="br-pad" style="padding:18px 40px 0;">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0"><tr>
                    <td><span class="br-muted" style="font-family:%s;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9c8c7d;font-weight:600;">%s</span></td>
                    <td align="right"><span class="br-ink" style="font-family:%s;font-size:14px;color:#3a2e27;font-weight:700;letter-spacing:0.5px;">%s</span></td>
                  </tr></table>
                </td></tr>
                """.formatted(SANS, esc(label), SANS, esc(value));
    }

    /** Panel with an items list and a total row. itemsHtml comes from itemRow(...). */
    private String panelRow(String pad, String label, String itemsHtml, String totalLabel, String totalAmount) {
        return """
                <tr><td class="br-pad" style="padding:%s;">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" class="br-panel" style="background:#faf5ec;border:1px solid #e7dbca;border-radius:14px;">
                    <tr><td style="padding:16px 18px 6px;">
                      <div class="br-gold" style="font-family:%s;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8c6d3f;font-weight:700;">%s</div>
                    </td></tr>
                    <tr><td style="padding:0 18px;">
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0">%s</table>
                    </td></tr>
                    <tr><td style="padding:4px 18px 16px;">
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0">
                        <tr><td class="br-hair" style="border-top:1px solid #e3d4c0;padding-top:14px;">
                          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0"><tr>
                            <td><span class="br-muted" style="font-family:%s;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9c8c7d;font-weight:700;">%s</span></td>
                            <td align="right" style="white-space:nowrap;"><span class="br-ink" style="font-family:%s;font-size:24px;color:#3a2e27;font-weight:700;">%s</span></td>
                          </tr></table>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </td></tr>
                """.formatted(pad, SANS, esc(label), itemsHtml, SANS, esc(totalLabel), SANS, totalAmount);
    }

    /** A single line inside a panel's items table. price/meta may be null. */
    private String itemRow(String name, String meta, String price, boolean last) {
        String bb = last ? "" : "border-bottom:1px solid #ece0d0;";
        String cls = last ? "" : "br-rowhair";
        String metaSpan = (meta == null || meta.isBlank()) ? ""
                : "<span class=\"br-muted\" style=\"font-family:" + SANS + ";font-size:12px;color:#9c8c7d;\">&nbsp;· " + esc(meta) + "</span>";
        String priceCell = (price == null || price.isBlank()) ? ""
                : "<span class=\"br-gold\" style=\"font-family:" + SANS + ";font-size:15px;color:#8c6d3f;font-weight:700;\">" + price + "</span>";
        return """
                <tr>
                  <td class="%s" style="padding:9px 0;%s"><span class="br-ink" style="font-family:%s;font-size:15px;color:#3a2e27;font-weight:600;">%s</span>%s</td>
                  <td align="right" class="%s" style="padding:9px 0;%swhite-space:nowrap;">%s</td>
                </tr>
                """.formatted(cls, bb, SANS, esc(name), metaSpan, cls, bb, priceCell);
    }

    /** Tinted pickup box (order). */
    private String ritiroRow(String mainLine, String subLine) {
        return """
                <tr><td class="br-pad" style="padding:18px 40px 0;">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" class="br-panel" style="background:rgba(184,151,106,0.10);border:1px solid #e7dbca;border-radius:14px;">
                    <tr><td style="padding:15px 18px;">
                      <div class="br-gold" style="font-family:%s;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8c6d3f;font-weight:700;margin-bottom:6px;">Ritiro</div>
                      <div class="br-ink" style="font-family:%s;font-size:21px;color:#3a2e27;line-height:1.25;">%s</div>
                      <div class="br-body" style="font-family:%s;font-size:14px;color:#574a41;margin-top:4px;">%s</div>
                    </td></tr>
                  </table>
                </td></tr>
                """.formatted(SANS, SERIF, esc(mainLine), SANS, esc(subLine));
    }

    /** Panel of stacked label/value rows (admin + informational emails). */
    private String detailsPanelRow(String[][] rows) {
        StringBuilder inner = new StringBuilder();
        for (int i = 0; i < rows.length; i++) {
            inner.append(detailRow(rows[i][0], rows[i][1], i == rows.length - 1));
        }
        return """
                <tr><td class="br-pad" style="padding:18px 40px 0;">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" class="br-panel" style="background:#faf5ec;border:1px solid #e7dbca;border-radius:14px;">
                    <tr><td style="padding:6px 18px;">
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0">%s</table>
                    </td></tr>
                  </table>
                </td></tr>
                """.formatted(inner.toString());
    }

    private String detailRow(String label, String value, boolean last) {
        String bb = last ? "" : "border-bottom:1px solid #ece0d0;";
        String cls = last ? "" : "br-rowhair";
        return """
                <tr><td class="%s" style="padding:10px 0;%s">
                  <div class="br-muted" style="font-family:%s;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9c8c7d;margin-bottom:3px;">%s</div>
                  <div class="br-ink" style="font-family:%s;font-size:15px;color:#3a2e27;font-weight:600;">%s</div>
                </td></tr>
                """.formatted(cls, bb, SANS, esc(label), SANS, esc(value));
    }

    private String buttonRow(String label, String url) {
        int w = Math.max(200, label.length() * 10 + 70);
        return """
                <tr><td align="center" class="br-pad" style="padding:30px 40px 6px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="%s" style="height:48px;v-text-anchor:middle;width:%dpx;" arcsize="27%%" strokecolor="#b8976a" fillcolor="#3a2e27">
                    <w:anchorlock/>
                    <center style="color:#fbf4e9;font-family:%s;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">%s</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="%s" class="br-btn" style="display:inline-block;background:#3a2e27;color:#fbf4e9;text-decoration:none;font-family:%s;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:15px 34px;border-radius:13px;border:1px solid #b8976a;">%s</a>
                  <!--<![endif]-->
                </td></tr>
                """.formatted(escAttr(url), w, SANS, esc(label), escAttr(url), SANS, esc(label));
    }

    private String helperRow(String html) {
        return """
                <tr><td align="center" class="br-pad" style="padding:20px 40px 0;">
                  <p class="br-muted" style="font-family:%s;font-size:13px;line-height:1.6;color:#9c8c7d;margin:0;">%s</p>
                </td></tr>
                """.formatted(SANS, html);
    }

    private String contactPillsRow() {
        String wa = pill("WhatsApp", "https://wa.me/" + waNum(),
                "<span style=\"color:#2ead5b;\">●</span>&nbsp; ");
        String call = pill("Chiama", "tel:" + brandPhoneE164, "");
        String mail = pill("Email", "mailto:" + brandEmail, "");
        return "<tr><td align=\"center\" style=\"padding:12px 30px 0;\">" + wa + call + mail + "</td></tr>";
    }

    private String pill(String label, String url, String dot) {
        return """
                <a href="%s" class="br-pill" style="display:inline-block;margin:5px 4px;font-family:%s;font-size:12px;color:#3a2e27;text-decoration:none;border:1px solid #e3d4c0;padding:9px 16px;border-radius:999px;background:#faf5ec;">%s%s</a>
                """.formatted(escAttr(url), SANS, dot, esc(label));
    }

    private String signoffRow(String lineHtml) {
        return """
                <tr><td align="center" class="br-pad" style="padding:26px 40px 36px;">
                  <div class="br-rowhair" style="border-top:1px solid #ece0d0;padding-top:20px;">
                    <span class="br-gold" style="font-family:%s;font-size:13px;color:#b8976a;letter-spacing:6px;">✦</span>
                    <p class="br-muted" style="font-family:%s;font-size:17px;font-style:italic;color:#7a6a5d;margin:8px 0 0;line-height:1.5;">%s</p>
                  </div>
                </td></tr>
                """.formatted(SERIF, SERIF, lineHtml);
    }

    // ===================== PRIMITIVES =====================

    private String inkB(String s) {
        return "<b class=\"br-ink\" style=\"color:#3a2e27;\">" + esc(s) + "</b>";
    }

    private String waNum() {
        return brandPhoneE164.replace("+", "");
    }

    private static String euro(BigDecimal v) {
        return "€ " + String.format(Locale.ITALY, "%,.2f", v.setScale(2, RoundingMode.HALF_UP));
    }

    private static String euroPlain(BigDecimal v) {
        return "€ " + String.format(Locale.ITALY, "%,.2f", v.setScale(2, RoundingMode.HALF_UP));
    }

    /** Plain-text twin of the booking emails (kept in sync with the HTML). */
    private String bookingText(String title, String greeting, BookingEmailModel m) {
        StringBuilder sb = new StringBuilder();
        sb.append(title).append(" · ").append(brandName).append("\n\n");
        sb.append(greeting).append("\n\n");
        sb.append("Quando: ").append(m.whenDate()).append(", ore ").append(m.whenTime());
        if (m.durationRange() != null && !m.durationRange().isBlank()) {
            sb.append(" (").append(m.durationRange()).append(")");
        }
        sb.append("\n");
        for (EmailSection sec : m.sections()) {
            sb.append("\n").append(sec.label()).append(":\n");
            for (EmailLine line : sec.lines()) {
                sb.append("  - ").append(line.name());
                if (line.meta() != null && !line.meta().isBlank()) {
                    sb.append(" (").append(line.meta()).append(")");
                }
                if (line.priceStr() != null && !line.priceStr().isBlank()) {
                    if (line.strikeStr() != null && !line.strikeStr().isBlank()) {
                        sb.append("  ").append(line.strikeStr()).append(" → ");
                    } else {
                        sb.append("  ");
                    }
                    sb.append(line.priceStr());
                }
                sb.append("\n");
            }
        }
        if (m.discountStr() != null) {
            sb.append("\n").append(m.discountLabel()).append(": ").append(m.discountStr()).append("\n");
        }
        if (m.totalStr() != null) {
            sb.append(m.totalLabel()).append(": ").append(m.totalStr()).append("\n");
        }
        if (m.packageBlock() != null) {
            sb.append("\n").append(m.packageBlock().headline()).append("\n");
            if (m.packageBlock().sessionInfo() != null && !m.packageBlock().sessionInfo().isBlank()) {
                sb.append(m.packageBlock().sessionInfo()).append("\n");
            }
            if (m.packageBlock().covered()) sb.append("Incluso nel pacchetto\n");
        }
        if (m.paymentLabel() != null && !m.paymentLabel().isBlank()) {
            sb.append("\nPagamento: ").append(m.paymentLabel()).append("\n");
        }
        sb.append("Dove: ").append(brandAddress).append("\n");
        if (m.customerEmail() != null && !m.customerEmail().isBlank()) {
            sb.append("Email di conferma: ").append(m.customerEmail()).append("\n");
        }
        sb.append("\nScrivimi su WhatsApp: https://wa.me/").append(waNum()).append("\n");
        sb.append("\nGrazie di avermi scelto. Non vedo l'ora di prendermi cura di te.\n");
        return sb.toString();
    }

    private static String cap(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private String safe(String s) {
        return (s == null || s.isBlank()) ? "-" : s;
    }

    private String esc(String s) {
        if (s == null) return "-";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private String escAttr(String s) {
        return esc(s).replace("'", "%27");
    }
}
