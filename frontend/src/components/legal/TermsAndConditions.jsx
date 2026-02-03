import { Container } from "react-bootstrap";

const TermsAndConditions = () => {
  const brandEmail = "rossimichela.pmu@gmail.com";

  return (
    <main className="legal-page">
      <Container className="legal-container">
        <header className="legal-header">
          <h1>Termini e Condizioni</h1>
          <p className="legal-subtitle">Regole di utilizzo del sito e dei servizi.</p>
        </header>

        <section className="legal-card">
          <h2>1. Oggetto</h2>
          <p>Il presente documento disciplina l’uso del sito e dei servizi offerti, inclusi prenotazioni e acquisti (se disponibili).</p>
        </section>

        <section className="legal-card">
          <h2>2. Prenotazioni</h2>
          <ul>
            <li>La prenotazione si considera confermata a seguito del completamento del pagamento (se richiesto) e della relativa conferma.</li>
            <li>È responsabilità dell’utente inserire dati corretti (email/telefono) per ricevere conferme e comunicazioni.</li>
            <li>Per modifiche o richieste, è possibile contattare il centro tramite i recapiti indicati sul sito.</li>
          </ul>
        </section>

        <section className="legal-card">
          <h2>3. Pagamenti e rimborsi</h2>
          <p>
            I pagamenti online sono gestiti da provider esterni. Eventuali rimborsi o annullamenti vengono gestiti secondo le condizioni comunicate al momento
            dell’acquisto/prenotazione e in base alla tipologia di servizio.
          </p>
          <p>
            Per richieste relative a pagamenti/rimborsi: <a href={`mailto:${brandEmail}`}>{brandEmail}</a>
          </p>
        </section>

        <section className="legal-card">
          <h2>4. Uso corretto del sito</h2>
          <p>
            È vietato usare il sito in modo illecito, tentare accessi non autorizzati o compromettere la sicurezza. Il Titolare può limitare o sospendere
            l’accesso in caso di abuso.
          </p>
        </section>

        <section className="legal-card">
          <h2>5. Proprietà intellettuale</h2>
          <p>Contenuti, immagini e materiali presenti sul sito sono protetti. È vietata la riproduzione senza autorizzazione.</p>
        </section>

        <section className="legal-card">
          <h2>6. Limitazione di responsabilità</h2>
          <p>Il Titolare si impegna a mantenere il sito aggiornato e funzionante, ma non garantisce l’assenza di interruzioni o errori tecnici.</p>
        </section>

        <section className="legal-card">
          <h2>7. Modifiche</h2>
          <p>I Termini possono essere aggiornati. La versione pubblicata sul sito è quella in vigore.</p>
        </section>

        <footer className="legal-footer">
          <p className="legal-muted">Ultimo aggiornamento: {new Date().toLocaleDateString()}</p>
        </footer>
      </Container>
    </main>
  );
};

export default TermsAndConditions;
