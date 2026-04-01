import { Container } from "react-bootstrap";

const CookiePolicy = () => {
  return (
    <main className="legal-page">
      <Container className="legal-container">
        <header className="legal-header">
          <h1>Cookie Policy</h1>
          <p className="legal-subtitle">Informazioni sull’uso di cookie e tecnologie simili.</p>
        </header>

        <section className="legal-card">
          <h2>1. Cosa sono i cookie</h2>
          <p>
            I cookie sono piccoli file di testo che i siti inviano al dispositivo dell’utente per migliorare l’esperienza di navigazione e abilitare alcune
            funzionalità.
          </p>
        </section>

        <section className="legal-card">
          <h2>2. Tipologie di cookie</h2>
          <ul>
            <li>
              <strong>Cookie tecnici/necessari</strong>: indispensabili per il funzionamento del sito (es. sessione, sicurezza). Non richiedono consenso.
            </li>
            <li>
              <strong>Cookie di preferenza</strong>: ricordano scelte dell’utente (es. lingua). Potrebbero richiedere consenso se non strettamente necessari.
            </li>
            <li>
              <strong>Cookie statistici/analytics</strong>: aiutano a capire come viene usato il sito (es. Google Analytics). Richiedono consenso, se non
              anonimizzati/tecnici.
            </li>
            <li>
              <strong>Cookie marketing/profilazione</strong>: usati per pubblicità e remarketing (es. Pixel). Richiedono consenso.
            </li>
          </ul>
        </section>

        <section className="legal-card">
          <h2>3. Tecnologie di storage usate su questo sito</h2>
          <p>Questo sito utilizza esclusivamente storage tecnico necessario:</p>
          <ul>
            <li>
              <strong>Cookie di sessione tecnici</strong>: necessari per la sicurezza e il funzionamento delle chiamate al server.
            </li>
            <li>
              <strong>localStorage - autenticazione</strong>: mantiene la sessione dell'utente loggato (token JWT). Viene rimosso al logout.
            </li>
            <li>
              <strong>localStorage - carrello</strong>: salva i prodotti aggiunti al carrello anche se si chiude il browser. Non contiene dati personali.
            </li>
          </ul>
          <p>
            <strong>Non utilizziamo</strong> cookie di profilazione, cookie di terze parti, pixel pubblicitari o strumenti di analytics che richiedano
            consenso. Per questo motivo non è presente un banner cookie.
          </p>
        </section>

        <section className="legal-card">
          <h2>4. Come gestire le preferenze</h2>
          <p>Puoi gestire o cancellare i cookie dal tuo browser. La disabilitazione dei cookie tecnici potrebbe compromettere alcune funzionalità del sito.</p>
        </section>

        <footer className="legal-footer">
          <p className="legal-muted">Ultimo aggiornamento: {new Date().toLocaleDateString()}</p>
        </footer>
      </Container>
    </main>
  );
};

export default CookiePolicy;
