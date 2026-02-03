package daviderocca.CAPSTONE_BACKEND.email.templates;

import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.Order;
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
""".formatted(
                h1Style(),
                pStyle(),
                esc(customerName),
                pStyle(),
                esc(brandAddress),
                detailsBox(new String[][]{
                        {"Servizio", serviceTitle},
                        {"Quando", when},
                        {"Email", safe(b.getCustomerEmail())}
                }),
                button("Visualizza prenotazione", viewUrl),
                smallStyle(),
                miniLink("WhatsApp", "https://wa.me/" + brandPhoneE164.replace("+","")),
                miniLink("Chiama", "tel:" + brandPhoneE164),
                miniLink("Email", "mailto:" + brandEmail)
        );

        String html = wrap(body);

        String text = """
                Prenotazione confermata - %s
                Ciao %s,
                La tua prenotazione è stata confermata. Ti aspettiamo in %s.

                Servizio: %s
                Quando: %s

                Visualizza: %s
                WhatsApp: https://wa.me/%s
                """.formatted(
                brandName, customerName, brandAddress, serviceTitle, when,
                viewUrl, brandPhoneE164.replace("+","")
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
        String subject = "Ordine pagato - " + brandName;

        String customer = (safe(o.getCustomerName()) + " " + safe(o.getCustomerSurname())).trim();
        if (customer.equals("- -")) customer = "-";

        BigDecimal total = BigDecimal.ZERO;
        if (o.getOrderItems() != null) {
            for (var item : o.getOrderItems()) {
                if (item == null || item.getPrice() == null) continue;
                total = total.add(item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
            }
        }
        String totalStr = total.setScale(2, RoundingMode.HALF_UP).toPlainString();
        String whenPaid = (o.getPaidAt() != null) ? o.getPaidAt().format(IT_DT) : "-";

        String body = """
            <h1 style="%s">Pagamento ricevuto</h1>

            <p style="%s">Ciao <b>%s</b>,</p>
            <p style="%s">abbiamo ricevuto il pagamento del tuo ordine.</p>

            %s

            <p style="%s; margin-top:14px;"><b>Nota ritiro:</b> %s</p>
            <p style="%s; margin-top:12px;">Grazie, a presto.</p>
        """.formatted(
                h1Style(),
                pStyle(),
                esc(customer),
                pStyle(),
                detailsBox(new String[][]{
                        {"Totale", "€ " + totalStr},
                        {"Email", safe(o.getCustomerEmail())},
                        {"Telefono", safe(o.getCustomerPhone())},
                        {"Pagato il", whenPaid}
                }),
                pStyle(),
                esc(safe(o.getPickupNote())),
                smallStyle()
        );

        return new EmailContent(subject, wrap(body), """
                Ordine pagato - %s
                Cliente: %s
                Totale: € %s
                Pagato il: %s
                Nota ritiro: %s
                """.formatted(brandName, customer, totalStr, whenPaid, safe(o.getPickupNote())));
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
}