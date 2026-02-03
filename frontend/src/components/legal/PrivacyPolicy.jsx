import { Container } from "react-bootstrap";

const PrivacyPolicy = () => {
  const business = {
    name: "Beauty Room",
    owner: "Michela Rossi",
    address: "Viale Risorgimento 587, Calusco d'Adda (BG), Italia",
    email: "rossimichela.pmu@gmail.com",
    phoneLabel: "+39 378 0921723",
    vat: "04837370164",
  };

  return (
    <main className="legal-page">
      <Container className="legal-container">
        <header className="legal-header">
          <h1>Privacy Policy</h1>
          <p className="legal-subtitle">Informativa resa ai sensi del Regolamento (UE) 2016/679 (“GDPR”).</p>
        </header>

        <section className="legal-card">
          <h2>1. Titolare del trattamento</h2>
          <p>
            Il Titolare del trattamento è <strong>{business.name}</strong> ({business.owner}), con sede in {business.address}.<br />
            Contatti: <a href={`mailto:${business.email}`}>{business.email}</a> —{" "}
            <a href={`tel:${business.phoneLabel.replace(/\s/g, "")}`}>{business.phoneLabel}</a>
            <br />
            P. IVA: {business.vat}
          </p>
        </section>

        <section className="legal-card">
          <h2>2. Dati trattati</h2>
          <p>Trattiamo i dati necessari a gestire i servizi del sito, in particolare:</p>
          <ul>
            <li>
              <strong>Dati identificativi e di contatto</strong>: nome e cognome, email, telefono.
            </li>
            <li>
              <strong>Dati relativi alle prenotazioni</strong>: servizio scelto, data/ora, eventuali note inserite dall’utente.
            </li>
            <li>
              <strong>Dati di pagamento</strong>: il pagamento online è gestito da provider esterni (es. Stripe). Il sito non memorizza i dati completi della
              carta.
            </li>
            <li>
              <strong>Dati tecnici</strong>: log tecnici e informazioni di navigazione (es. indirizzo IP), per sicurezza e funzionamento.
            </li>
          </ul>
        </section>

        <section className="legal-card">
          <h2>3. Finalità e basi giuridiche</h2>
          <ul>
            <li>
              <strong>Gestione prenotazioni e comunicazioni</strong> (conferme, promemoria): <em>esecuzione di un contratto / misure precontrattuali</em>.
            </li>
            <li>
              <strong>Gestione pagamenti e aspetti amministrativi</strong>: <em>esecuzione del contratto</em> e <em>adempimento di obblighi di legge</em>.
            </li>
            <li>
              <strong>Sicurezza e prevenzione abusi</strong>: <em>legittimo interesse</em> del Titolare.
            </li>
            <li>
              <strong>Marketing (solo se attivato e con consenso)</strong> (es. newsletter, promo via email): <em>consenso</em>. (Se non è attivo, questa
              finalità non si applica.)
            </li>
          </ul>
        </section>

        <section className="legal-card">
          <h2>4. Modalità del trattamento</h2>
          <p>
            I dati sono trattati con strumenti informatici e misure di sicurezza adeguate per prevenire accessi non autorizzati, divulgazione, modifica o
            distruzione non autorizzata dei dati.
          </p>
        </section>

        <section className="legal-card">
          <h2>5. Conservazione dei dati</h2>
          <ul>
            <li>
              <strong>Prenotazioni</strong>: per il tempo necessario a gestire il servizio e per eventuali esigenze organizzative e contabili.
            </li>
            <li>
              <strong>Obblighi fiscali/amministrativi</strong>: per i tempi previsti dalla legge.
            </li>
            <li>
              <strong>Log tecnici</strong>: per periodi limitati e proporzionati alle finalità di sicurezza.
            </li>
          </ul>
        </section>

        <section className="legal-card">
          <h2>6. Destinatari e fornitori (responsabili del trattamento)</h2>
          <p>
            Per erogare il servizio possiamo condividere alcuni dati con fornitori tecnici, nominati (se necessario) Responsabili del trattamento, ad esempio:
          </p>
          <ul>
            <li>
              <strong>Provider pagamenti</strong> (es. Stripe) per gestire l’incasso.
            </li>
            <li>
              <strong>Provider email</strong> (es. Mailgun) per invio conferme e promemoria.
            </li>
            <li>
              <strong>Hosting/Infrastructure</strong> dove risiede l’applicazione.
            </li>
          </ul>
          <p>Non vendiamo i tuoi dati a terzi.</p>
        </section>

        <section className="legal-card">
          <h2>7. Trasferimento extra-UE</h2>
          <p>
            Alcuni fornitori potrebbero trattare dati anche al di fuori dello Spazio Economico Europeo. In tali casi, il trasferimento avviene nel rispetto del
            GDPR (es. clausole contrattuali standard o altri strumenti adeguati).
          </p>
        </section>

        <section className="legal-card">
          <h2>8. Diritti dell’interessato</h2>
          <p>
            Puoi esercitare i diritti previsti dagli artt. 15-22 GDPR: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione, nonché revocare
            il consenso (se prestato). Per richieste: <a href={`mailto:${business.email}`}>{business.email}</a>.
          </p>
        </section>

        <section className="legal-card">
          <h2>9. Reclamo</h2>
          <p>Se ritieni che il trattamento violi il GDPR, puoi proporre reclamo al Garante per la protezione dei dati personali.</p>
        </section>

        <footer className="legal-footer">
          <p className="legal-muted">Ultimo aggiornamento: {new Date().toLocaleDateString()}</p>
        </footer>
      </Container>
    </main>
  );
};

export default PrivacyPolicy;
