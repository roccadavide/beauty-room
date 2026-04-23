package daviderocca.beautyroom.email.templates;

import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Order;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.entities.WaitlistEntry;
import daviderocca.beautyroom.enums.PaymentMethod;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class EmailTemplateService {

    @Value("${app.front.url:http://localhost:5173}")
    private String frontUrl;

    @Value("${app.brand.logoUrl:http://localhost:5173/logo-email.png}")
    private String logoUrl;

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

    private static final DateTimeFormatter IT_DT =
            DateTimeFormatter.ofPattern("EEE dd MMM yyyy, HH:mm", Locale.ITALY);

    private static final String BG = "#F6F1EA";
    private static final String CARD = "#FFFFFF";
    private static final String TEXT = "#3B2F2A";   // marrone caldo
    private static final String MUTED = "#7A6A61";  // taupe
    private static final String BORDER = "#E7D9CC"; // beige
    private static final String GOLD = "#C8A46A";   // oro soft
    private static final String SAND = "#F3E7DC";   // sabbia

    // ===================== BOOKING CONFIRMED =====================
    public EmailContent bookingConfirmed(Booking b) {
        String subject = "Prenotazione confermata - " + brandName;

        String when = (b.getStartTime() != null) ? b.getStartTime().format(IT_DT) : "-";
        String serviceTitle = safe(b.getService() != null ? b.getService().getTitle() : null);
        String customerName = safe(b.getCustomerName());

        // Prezzo: da opzione se presente, altrimenti dal servizio base
        BigDecimal price = null;
        if (b.getServiceOption() != null && b.getServiceOption().getPrice() != null) {
            price = b.getServiceOption().getPrice();
        } else if (b.getService() != null && b.getService().getPrice() != null) {
            price = b.getService().getPrice();
        }
        String priceStr = price != null ? "€\u00a0" + price.setScale(2, RoundingMode.HALF_UP).toPlainString() : null;

        boolean isPis = b.getPaymentMethod() == PaymentMethod.PAY_IN_STORE;
        String paymentLabel = isPis ? "Pagamento in studio" : "Pagamento ricevuto";
        String paymentValue = isPis
                ? "Da pagare in studio il giorno dell'appuntamento" + (priceStr != null ? ": " + priceStr : "")
                : "Pagamento online ricevuto" + (priceStr != null ? ": " + priceStr : "");

        String viewUrl = frontUrl + "/prenotazioni";

        String body = """
  <h1 style="%s">Prenotazione confermata</h1>

  <p style="%s">Ciao <b>%s</b>,</p>
  <p style="%s">la tua prenotazione è stata confermata. Ti aspettiamo in <b>%s</b>.</p>

  %s

  <div style="margin-top:18px;">
    %s
  </div>

  <p style="%s; margin-top:16px;">
    Vuoi <b>modificare</b> o <b>posticipare</b> la prenotazione? Scrivici su WhatsApp e ti aiutiamo noi.
  </p>

  <div style="margin-top:10px;">
    %s
    %s
    %s
  </div>

  <p style="font-family:Arial,sans-serif; font-size:13px; color:%s; text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid %s;">
    Grazie per aver scelto %s. Non vediamo l'ora di prenderci cura di te ✦
  </p>
""".formatted(
                h1Style(),
                pStyle(),
                esc(customerName),
                pStyle(),
                esc(brandAddress),
                detailsBox(new String[][]{
                        {"Servizio", serviceTitle},
                        {"Quando", when},
                        {paymentLabel, paymentValue},
                        {"Email", safe(b.getCustomerEmail())}
                }),
                button("Visualizza prenotazione", viewUrl),
                smallStyle(),
                miniLink("WhatsApp", "https://wa.me/" + brandPhoneE164.replace("+","")),
                miniLink("Chiama", "tel:" + brandPhoneE164),
                miniLink("Email", "mailto:" + brandEmail),
                MUTED, BORDER, esc(brandName)
        );

        String html = wrap(body);

        String text = """
                Prenotazione confermata - %s
                Ciao %s,
                La tua prenotazione è stata confermata. Ti aspettiamo in %s.

                Servizio: %s
                Quando: %s
                %s: %s

                Visualizza: %s
                WhatsApp: https://wa.me/%s

                Grazie per aver scelto %s. Non vediamo l'ora di prenderci cura di te.
                """.formatted(
                brandName, customerName, brandAddress, serviceTitle, when,
                paymentLabel, paymentValue,
                viewUrl, brandPhoneE164.replace("+",""),
                brandName
        );

        return new EmailContent(subject, html, text);
    }

    // ===================== BOOKING REMINDER =====================
    public EmailContent bookingReminder(Booking b) {
        String subject = "Promemoria prenotazione - " + brandName;

        String when = (b.getStartTime() != null) ? b.getStartTime().format(IT_DT) : "-";
        String serviceTitle = safe(b.getService() != null ? b.getService().getTitle() : null);
        String customerName = safe(b.getCustomerName());

        String body = """
            <h1 style="%s">Promemoria prenotazione</h1>

            <p style="%s">Ciao <b>%s</b>,</p>
            <p style="%s">ti ricordiamo la tua prenotazione. Ti aspettiamo in <b>%s</b>.</p>

            %s

            <p style="%s; margin-top:16px;">
                      Se hai imprevisti e vuoi posticipare, scrivici su WhatsApp il prima possibile.
                    </p>

            <div style="margin-top:10px;">
              %s
            </div>
        """.formatted(
                h1Style(),
                pStyle(),
                esc(customerName),
                pStyle(),
                esc(brandAddress),
                detailsBox(new String[][]{
                        {"Servizio", serviceTitle},
                        {"Quando", when}
                }),
                smallStyle(),
                miniLink("WhatsApp", "https://wa.me/" + brandPhoneE164.replace("+",""))
        );

        String html = wrap(body);

        String text = """
                Promemoria prenotazione - %s
                Ciao %s,
                Servizio: %s
                Quando: %s
                Dove: %s
                """.formatted(brandName, customerName, serviceTitle, when, brandAddress);

        return new EmailContent(subject, html, text);
    }

    // ===================== ORDER PAID =====================
    public EmailContent orderPaid(Order o) {
        String subject = "✨ Il tuo ordine è confermato — " + brandName;

        String firstName = (o.getCustomerName() != null && !o.getCustomerName().isBlank())
                ? o.getCustomerName().split(" ")[0]
                : "cara cliente";

        String fullName = (safe(o.getCustomerName()) + " " + safe(o.getCustomerSurname())).trim();
        if (fullName.equals("- -")) fullName = firstName;

        // Calcolo totale e righe articoli
        BigDecimal total = BigDecimal.ZERO;
        StringBuilder itemsHtml = new StringBuilder();
        StringBuilder itemsText = new StringBuilder();

        if (o.getOrderItems() != null && !o.getOrderItems().isEmpty()) {
            for (var item : o.getOrderItems()) {
                if (item == null || item.getPrice() == null || item.getProduct() == null) continue;

                BigDecimal lineTotal = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
                total = total.add(lineTotal);

                String productName = safe(item.getProduct().getName());
                String lineTotalStr = lineTotal.setScale(2, RoundingMode.HALF_UP).toPlainString();
                String unitStr = item.getPrice().setScale(2, RoundingMode.HALF_UP).toPlainString();

                itemsHtml.append("""
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;
                                padding:10px 0; border-bottom:1px solid %s;">
                      <div>
                        <div style="font-family:Arial,sans-serif; font-size:14px; font-weight:700; color:%s;">%s</div>
                        <div style="font-family:Arial,sans-serif; font-size:12px; color:%s; margin-top:2px;">
                          Qt. %d · €&nbsp;%s cad.
                        </div>
                      </div>
                      <div style="font-family:Arial,sans-serif; font-size:14px; font-weight:700;
                                  color:%s; white-space:nowrap; padding-left:12px;">
                        €&nbsp;%s
                      </div>
                    </div>
                """.formatted(BORDER, TEXT, esc(productName), MUTED,
                        item.getQuantity(), unitStr, GOLD, lineTotalStr));

                itemsText.append("  - ").append(productName)
                        .append(" x").append(item.getQuantity())
                        .append(" = € ").append(lineTotalStr).append("\n");
            }
        }

        String totalStr = total.setScale(2, RoundingMode.HALF_UP).toPlainString();
        String whenPaid = (o.getPaidAt() != null) ? o.getPaidAt().format(IT_DT) : "-";
        String orderId  = (o.getOrderId() != null) ? o.getOrderId().toString().toUpperCase().substring(0, 8) : "-";

        boolean isPis = o.getPaymentMethod() == PaymentMethod.PAY_IN_STORE;
        String orderIntroHtml = isPis
                ? "il tuo ordine è confermato. Pagherai <b>€\u00a0" + totalStr + "</b> direttamente al ritiro in <b>" + esc(brandAddress) + "</b>."
                : "il pagamento è andato a buon fine e il tuo ordine è confermato. Ti contatteremo appena sarà pronto per il ritiro in <b>" + esc(brandAddress) + "</b>.";
        String totalLabel = isPis ? "Da pagare al ritiro" : "Totale pagato";

        String pickupNote = (o.getPickupNote() != null && !o.getPickupNote().isBlank())
                ? o.getPickupNote() : null;

        String body = """
            <h1 style="%s">Ordine confermato ✦</h1>

            <p style="%s">Ciao <b>%s</b>,</p>
            <p style="%s">%s</p>

            <!-- Riepilogo articoli -->
            <div style="margin-top:18px; background:#FFFDFB; border:1px solid %s;
                        border-radius:14px; padding:4px 14px;">
              <div style="font-family:Arial,sans-serif; font-size:11px; font-weight:700;
                          letter-spacing:0.12em; text-transform:uppercase; color:%s;
                          padding:10px 0 6px;">
                Articoli
              </div>
              %s
              <!-- Totale -->
              <div style="display:flex; justify-content:space-between; align-items:center;
                          padding:12px 0; margin-top:4px;">
                <div style="font-family:Arial,sans-serif; font-size:11px; font-weight:700;
                            letter-spacing:0.12em; text-transform:uppercase; color:%s;">
                  %s
                </div>
                <div style="font-family:Arial,sans-serif; font-size:20px; font-weight:700; color:%s;">
                  €&nbsp;%s
                </div>
              </div>
            </div>

            <!-- Dettagli ordine -->
            %s

            %s

            <p style="%s; margin-top:16px;">
              Vuoi sapere quando è pronto il tuo ordine? Scrivici su WhatsApp.
            </p>

            <div style="margin-top:10px;">
              %s
              %s
              %s
            </div>

            <p style="font-family:Arial,sans-serif; font-size:13px; color:%s; text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid %s;">
              Grazie per aver scelto %s. Non vediamo l'ora di prenderci cura di te ✦
            </p>
        """.formatted(
                h1Style(),
                pStyle(), esc(firstName),
                pStyle(), orderIntroHtml,
                BORDER,
                GOLD,
                itemsHtml,
                GOLD, totalLabel, TEXT, totalStr,
                detailsBox(new String[][]{
                        {"Numero ordine", "#" + orderId},
                        {isPis ? "Consegna" : "Pagato il", isPis ? "Al ritiro" : whenPaid},
                        {"Email di conferma", safe(o.getCustomerEmail())}
                }),
                pickupNote != null
                    ? ("<div style=\"margin-top:14px; background:rgba(200,164,106,0.1); border:1px solid "
                       + BORDER + "; border-radius:12px; padding:12px 14px;\">"
                       + "<div style=\"font-family:Arial,sans-serif; font-size:11px; font-weight:700; "
                       + "letter-spacing:0.12em; text-transform:uppercase; color:" + GOLD + "; margin-bottom:4px;\">Nota ritiro</div>"
                       + "<div style=\"font-family:Arial,sans-serif; font-size:14px; color:" + TEXT + ";\">"
                       + esc(pickupNote) + "</div></div>")
                    : "",
                smallStyle(),
                miniLink("WhatsApp", "https://wa.me/" + brandPhoneE164.replace("+", "")),
                miniLink("Chiama", "tel:" + brandPhoneE164),
                miniLink("Email", "mailto:" + brandEmail),
                MUTED, BORDER, esc(brandName)
        );

        String html = wrap(body);

        String text = """
                Ordine confermato — %s
                Ciao %s, il tuo ordine è confermato!

                Numero ordine: #%s
                %s: %s

                Articoli:
                %s
                Totale: € %s

                Ritiro presso: %s
                %s
                WhatsApp: https://wa.me/%s

                Grazie per aver scelto %s. Non vediamo l'ora di prenderci cura di te.
                """.formatted(
                brandName, firstName,
                orderId,
                isPis ? "Da pagare al ritiro" : "Pagato il",
                isPis ? "Al momento del ritiro" : whenPaid,
                itemsText,
                totalStr,
                brandAddress,
                pickupNote != null ? "Nota ritiro: " + pickupNote + "\n" : "",
                brandPhoneE164.replace("+", ""),
                brandName
        );

        return new EmailContent(subject, html, text);
    }

    // ===================== PAID CONFLICT ALERT (ADMIN) =====================
    public EmailContent paidConflictAlert(Booking b, String stripeSessionId) {
        String subject = "⚠️ PAID_CONFLICT — Prenotazione pagata su slot già occupato";

        String when = (b.getStartTime() != null) ? b.getStartTime().format(IT_DT) : "-";
        String customerName = safe(b.getCustomerName());
        String bookingId = b.getBookingId() != null ? b.getBookingId().toString() : "-";
        String sessionId = (stripeSessionId != null && !stripeSessionId.isBlank()) ? stripeSessionId : "-";

        String body = """
            <h1 style="%s">⚠️ Pagamento su slot occupato</h1>

            <p style="%s">
              Si è verificato un <b>PAID_CONFLICT</b> su una prenotazione pagata con Stripe.
            </p>

            %s

            <p style="%s; margin-top:16px;">
              <b>Azione richiesta:</b> effettua manualmente il rimborso su Stripe
              e contatta la cliente per fissare un nuovo appuntamento.
            </p>
        """.formatted(
                h1Style(),
                pStyle(),
                detailsBox(new String[][]{
                        {"Booking ID", bookingId},
                        {"Cliente", customerName},
                        {"Data/ora", when},
                        {"Stripe Session", sessionId}
                }),
                smallStyle()
        );

        String html = wrap(body);

        String text = """
                ⚠️ PAID_CONFLICT — Prenotazione pagata su slot già occupato

                Prenotazione ID: %s
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
        String subject = "Rimborso in arrivo - " + brandName;

        String when = (b.getStartTime() != null) ? b.getStartTime().format(IT_DT) : "-";
        String serviceTitle = safe(b.getService() != null ? b.getService().getTitle() : null);
        String customerName = safe(b.getCustomerName());

        String body = """
  <h1 style="%s">Rimborso in arrivo</h1>

  <p style="%s">Ciao <b>%s</b>,</p>
  <p style="%s">
    ci dispiace informarti che la tua prenotazione non è stata confermata perché
    lo slot era già stato occupato da un'altra cliente nel frattempo.
    Il pagamento che hai effettuato su Stripe verrà <b>rimborsato automaticamente</b>
    entro 5-10 giorni lavorativi.
  </p>

  %s

  <p style="%s; margin-top:16px;">
    Contattaci su WhatsApp o per email per concordare un nuovo appuntamento:
    siamo spiacenti per l'inconveniente.
  </p>

  <div style="margin-top:10px;">
    %s
    %s
    %s
  </div>
""".formatted(
                h1Style(),
                pStyle(),
                esc(customerName),
                pStyle(),
                detailsBox(new String[][]{
                        {"Servizio", serviceTitle},
                        {"Data/ora prenotata", when},
                        {"Email", safe(b.getCustomerEmail())}
                }),
                smallStyle(),
                miniLink("WhatsApp", "https://wa.me/" + brandPhoneE164.replace("+", "")),
                miniLink("Chiama", "tel:" + brandPhoneE164),
                miniLink("Email", "mailto:" + brandEmail)
        );

        String html = wrap(body);

        String text = """
                Rimborso in arrivo - %s
                Ciao %s,
                La tua prenotazione non è stata confermata (slot già occupato).
                Il pagamento verrà rimborsato automaticamente entro 5-10 giorni lavorativi.

                Servizio: %s
                Data/ora: %s

                WhatsApp: https://wa.me/%s
                """.formatted(
                brandName, customerName, serviceTitle, when, brandPhoneE164.replace("+", "")
        );

        return new EmailContent(subject, html, text);
    }

    // ===================== USER REGISTERED (admin notification) =====================
    public EmailContent userRegistered(User u) {
        String subject = "Nuova registrazione - " + brandName;
        String fullName = safe(u.getName()) + " " + safe(u.getSurname());
        String email = safe(u.getEmail());
        String phone = safe(u.getPhone());

        String adminUrl = brandEmail; // URL pannello admin — placeholder

        String body = """
  <h1 style="%s">Nuova cliente registrata</h1>

  <p style="%s">Una nuova utente si è appena registrata su <b>%s</b>.</p>

  %s

  <p style="%s; margin-top:16px;">
    Puoi verificarla come <b>Cliente di Fiducia</b> dal pannello Gestione → Account.
  </p>
""".formatted(
                h1Style(),
                pStyle(),
                esc(brandName),
                detailsBox(new String[][]{
                        {"Nome", fullName.trim()},
                        {"Email", email},
                        {"Telefono", phone}
                }),
                smallStyle()
        );

        String html = wrap(body);

        String text = """
                Nuova registrazione - %s
                Una nuova utente si è appena registrata: %s (%s, %s).
                Puoi verificarla dal pannello admin.
                """.formatted(brandName, fullName.trim(), email, phone);

        return new EmailContent(subject, html, text);
    }

    // ===================== LAYOUT HELPERS =====================

    private String wrap(String innerHtml) {
        return """
        <div style="margin:0; padding:0; background:%s;">
          <div style="max-width:640px; margin:0 auto; padding:26px 14px;">

            %s

            <div style="background:%s; border-radius:16px; padding:22px 18px;
                        border:1px solid %s; box-shadow:0 10px 24px rgba(59,47,42,0.08);">
              %s
            </div>

            %s

          </div>
        </div>
        """.formatted(BG, headerBar(), CARD, BORDER, innerHtml, footer());
    }

    private String headerBar() {
        String subtitle = "Trucco permanente • Laser • Estetica avanzata";

        return """
    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0"
           style="border-collapse:collapse; background:%s; border:1px solid %s; border-radius:16px; margin-bottom:14px;">
      <tr>
        <td style="padding:18px;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse; width:100%%;">
            <tr>
              <td width="110" style="vertical-align:middle; padding-right:14px;">
                <img src="%s" alt="%s"
                     style="display:block; width:96px; max-width:96px; height:auto; border:0; outline:none; text-decoration:none;" />
              </td>

              <td style="vertical-align:middle;">
                <div style="font-family:Arial,sans-serif; color:%s; font-size:26px; font-weight:800; line-height:1.1; margin:0;">
                  %s
                </div>
                <div style="font-family:Arial,sans-serif; color:%s; font-size:12px; letter-spacing:0.3px; margin-top:6px;">
                  %s
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    """.formatted(
                SAND, BORDER,
                escAttr(logoUrl), esc(brandName),
                TEXT, esc(brandName),
                MUTED, esc(subtitle)
        );
    }

    private String detailsBox(String[][] rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
            <div style="margin-top:14px; background:%s; border:1px solid %s; border-radius:14px; padding:12px 14px;">
        """.formatted("#FFFDFB", BORDER));

        for (int i = 0; i < rows.length; i++) {
            String[] r = rows[i];
            sb.append(detailRow(r[0], r[1], i == rows.length - 1));
        }

        sb.append("</div>");
        return sb.toString();
    }

    private String detailRow(String label, String value, boolean last) {
        String border = last ? "none" : "1px solid " + BORDER;
        return """
          <div style="padding:8px 0; border-bottom:%s;">
            <div style="font-family:Arial,sans-serif; font-size:12px; color:%s; margin-bottom:2px;">%s</div>
            <div style="font-family:Arial,sans-serif; font-size:14px; color:%s; font-weight:700;">%s</div>
          </div>
        """.formatted(border, MUTED, esc(label), TEXT, esc(value));
    }

    private String button(String label, String url) {
        return """
          <a href="%s"
             style="display:inline-block; background:%s; color:white; text-decoration:none;
                    font-family:Arial,sans-serif; font-weight:700; font-size:14px;
                    padding:12px 18px; border-radius:14px; border:1px solid %s;">
             %s
          </a>
        """.formatted(escAttr(url), TEXT, GOLD, esc(label));
    }

    private String miniLink(String label, String url) {
        return """
          <a href="%s" style="display:inline-block; margin-right:10px; margin-top:6px;
                              font-family:Arial,sans-serif; font-size:12px; color:%s; text-decoration:none;
                              border:1px solid %s; padding:8px 10px; border-radius:999px; background:%s;">
            %s
          </a>
        """.formatted(escAttr(url), TEXT, BORDER, SAND, esc(label));
    }

    private String footer() {
        return """
        <div style="margin-top:14px; background:%s; border-radius:16px; padding:16px 18px; border:1px solid %s;">
          <div style="font-family:Arial,sans-serif; color:%s; font-size:13px; font-weight:700;">%s</div>

          <div style="font-family:Arial,sans-serif; color:%s; font-size:12px; margin-top:8px; line-height:1.7;">
            %s<br/>
            Tel/WhatsApp: <a style="color:%s; text-decoration:none;" href="tel:%s">%s</a> ·
            <a style="color:%s; text-decoration:none;" href="https://wa.me/%s">WhatsApp</a><br/>
            Email: <a style="color:%s; text-decoration:none;" href="mailto:%s">%s</a><br/>
            P. IVA: %s
          </div>

          <div style="font-family:Arial,sans-serif; color:%s; font-size:12px; margin-top:10px;">
            <a style="color:%s; text-decoration:none;" href="%s">Instagram</a> ·
            <a style="color:%s; text-decoration:none;" href="%s">Facebook</a>
          </div>

          <div style="margin-top:12px; border-top:1px solid %s; padding-top:10px;
                      font-family:Arial,sans-serif; color:%s; font-size:11px;">
            © %d %s - Tutti i diritti riservati
          </div>
        </div>
        """.formatted(
                SAND, BORDER, TEXT, esc(brandName),
                MUTED,
                esc(brandAddress),
                TEXT, brandPhoneE164, esc(brandPhoneLabel),
                TEXT, brandPhoneE164.replace("+",""),
                TEXT, escAttr(brandEmail), esc(brandEmail),
                esc(brandVat),
                MUTED,
                TEXT, escAttr(instagramUrl),
                TEXT, escAttr(facebookUrl),
                BORDER, MUTED,
                java.time.LocalDate.now().getYear(), esc(brandName)
        );
    }

    private String h1Style() {
        return "font-family:Arial,sans-serif; margin:0 0 10px 0; color:" + TEXT + "; font-size:22px; line-height:1.2;";
    }
    private String pStyle() {
        return "font-family:Arial,sans-serif; margin:0; color:" + TEXT + "; font-size:14px; line-height:1.65;";
    }
    private String smallStyle() {
        return "font-family:Arial,sans-serif; margin:0; color:" + MUTED + "; font-size:12px; line-height:1.65;";
    }

    private String safe(String s) { return (s == null || s.isBlank()) ? "-" : s; }

    private String esc(String s) {
        if (s == null) return "-";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
    private String escAttr(String s) { return esc(s).replace("'", "%27"); }

    // ===================== WAITLIST SLOT AVAILABLE =====================
    public EmailContent waitlistSlotAvailable(WaitlistEntry entry, String bookingLink) {
        String firstName = entry.getCustomerName() != null
                ? entry.getCustomerName().split(" ")[0] : "cara cliente";
        String serviceTitle = entry.getService() != null
                ? entry.getService().getTitle() : "il tuo trattamento";
        String dateStr = entry.getRequestedDate()
                .format(java.time.format.DateTimeFormatter.ofPattern("EEEE d MMMM", java.util.Locale.ITALIAN));
        String timeStr = entry.getRequestedTime().toString().substring(0, 5);

        String body = """
          <h1 style="%s">Il tuo slot si è liberato! 🎉</h1>

          <p style="%s">Ciao <b>%s</b>, ottima notizia:<br>
          si è liberato uno slot per <b>%s</b>.</p>

          <div style="background:#fef7ef; border:1px solid %s; border-radius:12px;
                      padding:16px 20px; margin:18px 0; text-align:center;">
            <div style="font-family:Arial,sans-serif; font-size:1rem; font-weight:600; color:%s;">%s</div>
            <div style="font-family:Arial,sans-serif; font-size:1.3rem; font-weight:700; color:%s; margin-top:4px;">🕐 %s</div>
          </div>

          <p style="%s">Clicca qui sotto per prenotare — il link è riservato a te:</p>

          <div style="margin-top:14px;">
            %s
          </div>

          <div style="background:rgba(184,151,106,0.1); border-radius:8px; padding:10px 14px; margin-top:18px;
                      font-family:Arial,sans-serif; font-size:12px; color:%s;">
            ⏳ Hai <b>2 ore</b> per completare la prenotazione, dopodiché
            lo slot sarà offerto alla persona successiva in lista.
          </div>

          <p style="%s; margin-top:16px;">
            Se non sei più interessata, ignora questa email.
          </p>
          """.formatted(
                h1Style(),
                pStyle(), esc(firstName), esc(serviceTitle),
                BORDER, TEXT, esc(dateStr), GOLD, esc(timeStr),
                pStyle(),
                button("✨ Prenota adesso", bookingLink),
                MUTED,
                smallStyle()
        );

        String html = wrap(body);

        String text = ("Ciao %s,\n\nSi è liberato uno slot per %s!\n\nData: %s\nOra: %s\n\n"
                + "Prenota qui (link valido 2 ore):\n%s\n\n%s")
                .formatted(firstName, serviceTitle, dateStr, timeStr, bookingLink, brandName);

        return new EmailContent("Slot disponibile! Prenota adesso — " + brandName, html, text);
    }

    // ===================== REVIEW REQUEST =====================
    public EmailContent reviewRequest(Booking b) {
        String firstName = b.getCustomerName() != null
                ? b.getCustomerName().split(" ")[0]
                : "cara cliente";

        String serviceTitle = b.getService() != null
                ? b.getService().getTitle()
                : "il tuo trattamento";

        String subject = "Come ti sei trovata? \u2b50 \u2013 " + brandName;

        String body = """
          <h1 style="%s">Come ti sei trovata, %s?</h1>

          <div style="font-family:Arial,sans-serif; font-size:24px; letter-spacing:6px; margin:14px 0 18px;">
            \u2b50\u2b50\u2b50\u2b50\u2b50
          </div>

          <p style="%s">
            Grazie per aver scelto <b>%s</b> per
            <span style="color:%s; font-weight:700;">%s</span>.
            La tua opinione \u00e8 preziosa e aiuta altre persone a trovarci.
          </p>

          <p style="%s">
            Se sei rimasta soddisfatta, ci farebbe enormemente piacere leggere
            una tua recensione — bastano due minuti:
          </p>

          <div style="margin-top:18px;">
            %s
          </div>

          <p style="%s; margin-top:20px;">
            Se invece c'\u00e8 qualcosa che potremmo migliorare, rispondi
            direttamente a questa email — Michela legge tutto personalmente.
          </p>
          """.formatted(
                h1Style(),
                esc(firstName),
                pStyle(), esc(brandName), GOLD, esc(serviceTitle),
                pStyle(),
                button("\u2728 Lascia la tua recensione", googleReviewUrl),
                smallStyle()
        );

        String html = wrap(body);

        String text = ("Ciao %s,\n\nGrazie per aver scelto %s per %s.\n\n"
                + "Se sei rimasta soddisfatta, ci farebbe piacere leggere una tua recensione:\n%s\n\n"
                + "Per qualsiasi feedback rispondi a questa email — Michela legge tutto personalmente.\n\n"
                + "%s").formatted(
                firstName, brandName, serviceTitle, googleReviewUrl, brandName);

        return new EmailContent(subject, html, text);
    }

    // ===================== PRODUCT BACK IN STOCK =====================
    public EmailContent productBackInStock(String customerName, String productName,
                                           String productUrl, String email) {
        String subject = "\"" + productName + "\" \u00e8 di nuovo disponibile \u2013 " + brandName;
        String safeCustomer = safe(customerName);
        String safeProduct  = safe(productName);

        String body = """
            <h1 style="%s">Buone notizie!</h1>

            <p style="%s">Ciao <b>%s</b>,</p>
            <p style="%s">
              il prodotto che stavi aspettando \u00e8 tornato disponibile in negozio.
            </p>

            %s

            <div style="margin-top:18px;">
              %s
            </div>

            <p style="%s; margin-top:16px;">
              Gli articoli si esauriscono velocemente \u2014 ti consigliamo di procedere all'acquisto
              il prima possibile.
            </p>
            """.formatted(
                    h1Style(),
                    pStyle(),
                    esc(safeCustomer),
                    pStyle(),
                    detailsBox(new String[][]{
                        {"Prodotto", safeProduct},
                        {"Negozio", brandName},
                        {"Dove", brandAddress}
                    }),
                    button("Acquista ora", productUrl),
                    smallStyle()
            );

        String html = wrap(body);
        String text = """
                %s \u00e8 di nuovo disponibile \u2013 %s
                Ciao %s,
                il prodotto "%s" \u00e8 tornato disponibile.
                Acquista ora: %s
                """.formatted(safeProduct, brandName, safeCustomer, safeProduct, productUrl);

        return new EmailContent(subject, html, text);
    }
}