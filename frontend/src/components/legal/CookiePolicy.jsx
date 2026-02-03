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
          <h2>3. Cookie usati su questo sito</h2>
          <p>
            Attualmente il sito può utilizzare cookie tecnici necessari al funzionamento e alla sicurezza. Se in futuro verranno attivati cookie analytics o
            marketing, verrà richiesto il consenso tramite banner.
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
