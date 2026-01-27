package daviderocca.CAPSTONE_BACKEND.email.templates;

import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.Order;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class EmailTemplateService {

    @Value("${app.front.url:http://localhost:5173}")
    private String frontUrl;

    private static final DateTimeFormatter IT_DT = DateTimeFormatter
            .ofPattern("EEE dd MMM yyyy, HH:mm", Locale.ITALY);

    public EmailContent bookingConfirmed(Booking b) {
        String subject = "Prenotazione confermata - Beauty Room";

        String when = (b.getStartTime() != null) ? b.getStartTime().format(IT_DT) : "-";
        String serviceTitle = safe(b.getService() != null ? b.getService().getTitle() : null);

        String html = """
          <div style="font-family:Arial,sans-serif;line-height:1.4">
            <h2>Prenotazione confermata ✅</h2>
            <p>Ciao %s,</p>
            <p>La tua prenotazione è confermata.</p>
            <ul>
              <li><b>Servizio:</b> %s</li>
              <li><b>Quando:</b> %s</li>
            </ul>
            <p>Gestisci la prenotazione: <a href="%s">apri</a></p>
          </div>
        """.formatted(
                safe(b.getCustomerName()),
                serviceTitle,
                when,
                frontUrl + "/le-mie-prenotazioni"
        );

        String text = "Prenotazione confermata ✅\nServizio: %s\nQuando: %s\n\nGestisci: %s"
                .formatted(serviceTitle, when, frontUrl + "/le-mie-prenotazioni");

        return new EmailContent(subject, html, text);
    }

    public EmailContent bookingReminder(Booking b) {
        String subject = "Promemoria prenotazione - Beauty Room";

        String when = (b.getStartTime() != null) ? b.getStartTime().format(IT_DT) : "-";
        String serviceTitle = safe(b.getService() != null ? b.getService().getTitle() : null);

        String html = """
          <div style="font-family:Arial,sans-serif;line-height:1.4">
            <h2>Promemoria ⏰</h2>
            <p>Ciao %s, ti ricordiamo la tua prenotazione:</p>
            <ul>
              <li><b>Servizio:</b> %s</li>
              <li><b>Quando:</b> %s</li>
            </ul>
          </div>
        """.formatted(
                safe(b.getCustomerName()),
                serviceTitle,
                when
        );

        String text = "Promemoria prenotazione ⏰\nServizio: %s\nQuando: %s"
                .formatted(serviceTitle, when);

        return new EmailContent(subject, html, text);
    }

    public EmailContent orderPaid(Order o) {
        String subject = "Ordine pagato - Beauty Room";

        String customer = safe(o.getCustomerName()) + " " + safe(o.getCustomerSurname());
        String phone = safe(o.getCustomerPhone());
        String pickupNote = safe(o.getPickupNote());

        BigDecimal total = BigDecimal.ZERO;
        if (o.getOrderItems() != null) {
            for (var item : o.getOrderItems()) {
                if (item == null) continue;
                if (item.getPrice() == null) continue;
                int qty = item.getQuantity();
                total = total.add(item.getPrice().multiply(BigDecimal.valueOf(qty)));
            }
        }

        String whenPaid = (o.getPaidAt() != null) ? o.getPaidAt().format(IT_DT) : "-";

        String html = """
      <div style="font-family:Arial,sans-serif;line-height:1.4">
        <h2>Ordine pagato ✅</h2>
        <p>Ciao %s,</p>
        <p>Abbiamo ricevuto il pagamento del tuo ordine.</p>
        <ul>
          <li><b>Totale:</b> € %s</li>
          <li><b>Email:</b> %s</li>
          <li><b>Telefono:</b> %s</li>
          <li><b>Pagato il:</b> %s</li>
        </ul>
        <p><b>Nota ritiro:</b> %s</p>
        <p>Grazie! 💛</p>
      </div>
    """.formatted(
                customer.trim().equals("- -") ? "-" : customer,
                total.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString(),
                safe(o.getCustomerEmail()),
                phone,
                whenPaid,
                pickupNote
        );

        String text = """
        Ordine pagato ✅
        Cliente: %s
        Totale: € %s
        Pagato il: %s
        Nota ritiro: %s
        """.formatted(
                customer.trim().equals("- -") ? "-" : customer,
                total.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString(),
                whenPaid,
                pickupNote
        );

        return new EmailContent(subject, html, text);
    }

    private String safe(String s) { return (s == null || s.isBlank()) ? "-" : s; }
}