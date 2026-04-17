import { useEffect, useRef, useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import CountUp from "../../components/common/CountUp";
import CircularText from "../../components/common/CircularText";
import SEO from "../../components/common/SEO";

const AboutDescription = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState({});
  const refs = useRef({});

  const reg = key => el => {
    if (el) refs.current[key] = el;
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries =>
        entries.forEach(e => {
          if (e.isIntersecting) setVisible(p => ({ ...p, [e.target.dataset.key]: true }));
        }),
      { threshold: 0.15 },
    );
    Object.values(refs.current).forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const values = [
    {
      title: "Ascolto autentico",
      text: "Ogni appuntamento inizia con una conversazione vera. Capire chi ho davanti è il primo passo per un risultato che ti somiglia.",
    },
    {
      title: "Formazione continua",
      text: "Il mondo beauty evolve ogni anno. Aggiornarsi e sperimentare nuove tecniche non è un obbligo per me — è la mia passione.",
    },
    {
      title: "Risultati naturali",
      text: "Nessun effetto eccessivo, nessuna maschera. Il mio obiettivo è valorizzare la tua bellezza autentica, con cura e misura.",
    },
  ];

  const stats = [
    { numeric: 5, suffix: "+", label: "anni di esperienza" },
    { numeric: 500, suffix: "+", label: "clienti soddisfatte" },
    { numeric: 20, suffix: "+", label: "trattamenti specializzati" },
    { numeric: null, symbol: "♾", label: "passione ogni giorno" },
  ];

  const skills = [
    "Trattamenti viso",
    "Massaggi rilassanti",
    "Manicure & Pedicure",
    "Epilazione",
    "Make-up personalizzato",
    "Laminazione ciglia",
    "Trucco semipermanente",
    "Rituali benessere",
  ];

  return (
    <div className="ab-root">
      <SEO title="Chi Sono" description="Conosci Michela, estetista specializzata in laser e trattamenti estetici avanzati a Calusco d'Adda." />
      {/* ══ HERO ══ */}
      <section className="ab-hero">
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={6} className="order-lg-1 order-2">
              <div className={`ab-fade ab-fade--left ${visible["hero-text"] ? "ab-fade--in" : ""}`} data-key="hero-text" ref={reg("hero-text")}>
                <span className="section-eyebrow">Chi Sono</span>
                <h1 className="ab-hero-title">
                  Michela,
                  <br />
                  <em>Beauty Room</em>
                </h1>
                <div className="ab-accent-bar" />
                <p className="ab-hero-lead">
                  Ho aperto Beauty Room con un'idea semplice: creare uno spazio dove ogni persona si senta vista, ascoltata e valorizzata. Non solo
                  esteticamente — ma come essere umano.
                </p>
                <p className="ab-body-text">
                  Sono nata con la passione per il bello inteso come cura, come attenzione ai dettagli, come gesto di rispetto verso se stessi. Da anni
                  trasformo questa passione in un lavoro fatto di professionalità e tanto cuore.
                </p>
              </div>
            </Col>

            <Col lg={6} className="order-lg-2 order-1">
              <div className={`ab-fade ab-fade--right ${visible["hero-img"] ? "ab-fade--in" : ""}`} data-key="hero-img" ref={reg("hero-img")}>
                <div className="ab-portrait-wrap">
                  <div className="ab-portrait-frame">
                    <img src="/negoziomichi.jpeg" alt="Michela — Beauty Room" className="ab-portrait" />
                  </div>
                  <div className="ab-portrait-badge">
                    <span className="ab-portrait-badge__dot" />
                    Beauty Room
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* ══ STATS ══ */}
      <section className="ab-stats-section">
        <Container>
          <div className={`ab-fade ab-fade--up ${visible["stats"] ? "ab-fade--in" : ""}`} data-key="stats" ref={reg("stats")}>
            <div className="ab-stats-grid">
              {stats.map((s, i) => (
                <div className="ab-stat" key={i} style={{ "--delay": `${i * 0.1}s` }}>
                  <span className="ab-stat__value">
                    {s.numeric !== null ? (
                      <>
                        <CountUp from={0} to={s.numeric} duration={2} delay={i * 0.1} separator="" startWhen={true} />
                        {s.suffix}
                      </>
                    ) : (
                      s.symbol
                    )}
                  </span>
                  <span className="ab-stat__label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ══ VALORI ══ */}
      <section className="ab-values-section">
        <Container>
          <div className="text-center mb-5">
            <span className="section-eyebrow">Il mio approccio</span>
            <h2 className="section-title">Cosa mi guida ogni giorno</h2>
            <p className="section-subtitle">Non esiste una formula magica. Esiste l'attenzione, la cura e la volontà di fare le cose per bene.</p>
          </div>
          <Row className="g-4">
            {values.map((v, i) => (
              <Col md={4} key={i}>
                <div
                  className={`ab-value-card ab-fade ab-fade--up ${visible[`val-${i}`] ? "ab-fade--in" : ""}`}
                  data-key={`val-${i}`}
                  ref={reg(`val-${i}`)}
                  style={{ "--delay": `${i * 0.15}s` }}
                >
                  <h3 className="ab-value-title">{v.title}</h3>
                  <div className="ab-accent-line" />
                  <p className="ab-value-text">{v.text}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* ══ STORIA ══ */}
      <section className="ab-story-section">
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={5}>
              <div
                className={`ab-story-img-wrap ab-fade ab-fade--left ${visible["story-img"] ? "ab-fade--in" : ""}`}
                data-key="story-img"
                ref={reg("story-img")}
              >
                <div className="ab-story-img-frame">
                  <img src="/michela.JPEG" alt="Beauty Room" />
                </div>
                <div className="ab-story-deco" />
                <div className="circular-badge-portrait">
                  <CircularText text="BEAUTY✦ROOM✦BEAUTY✦ROOM✦" spinDuration={18} onHover="slowDown" logoSrc="/logo.png" logoAlt="Beauty Room" />
                </div>
              </div>
            </Col>
            <Col lg={7}>
              <div className={`ab-fade ab-fade--right ${visible["story-text"] ? "ab-fade--in" : ""}`} data-key="story-text" ref={reg("story-text")}>
                <span className="section-eyebrow">La mia storia</span>
                <h2 className="section-title">Da passione a professione</h2>
                <div className="ab-accent-bar" />
                <p className="ab-body-text mt-4">
                  Ho iniziato con una certezza e mille dubbi. La certezza era che avrei voluto dedicarmi alla cura delle persone; i dubbi erano quelli di
                  chiunque stia costruendo qualcosa da zero.
                </p>
                <p className="ab-body-text">
                  Anni di formazione, corsi specializzati, sperimentazione e — soprattutto — tantissime ore passate ad ascoltare le clienti. A capire che ogni
                  persona ha la sua storia, le sue insicurezze, i suoi desideri.
                </p>
                <p className="ab-body-text">
                  Oggi Beauty Room è un luogo dove la professionalità si mescola all'accoglienza. Dove vieni chiamata per nome, dove puoi parlare liberamente,
                  dove esci con qualcosa in più — non solo nel look.
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* ══ SPECIALIZZAZIONI ══ */}
      <section className="ab-skills-section">
        <Container>
          <div className="text-center mb-5">
            <span className="section-eyebrow">Specializzazioni</span>
            <h2 className="section-title">I miei punti di forza</h2>
            <p className="section-subtitle">Non esiste una formula magica. Esiste l'attenzione, la cura e la volontà di fare le cose per bene.</p>
          </div>
          <div className={`ab-chips ab-fade ab-fade--up ${visible["chips"] ? "ab-fade--in" : ""}`} data-key="chips" ref={reg("chips")}>
            {skills.map((s, i) => (
              <span className="ab-chip" key={i} style={{ "--delay": `${i * 0.07}s` }}>
                {s}
              </span>
            ))}
          </div>
        </Container>
      </section>

      {/* ══ FILOSOFIA / QUOTE ══ */}
      <section className="ab-philosophy-section">
        <Container>
          <Row className="justify-content-center">
            <Col lg={9}>
              <div className={`ab-philosophy-card ab-fade ab-fade--up ${visible["philo"] ? "ab-fade--in" : ""}`} data-key="philo" ref={reg("philo")}>
                <div className="ab-philosophy-ornament">✦</div>
                <blockquote className="ab-philosophy-quote">
                  Ogni persona merita un momento per sé. Un momento di silenzio, di cura, di presenza. Nei miei trattamenti non vendo solo un risultato — offro
                  un rituale di benessere che inizia quando varchi la porta e finisce quando esci, più leggera.
                </blockquote>
                <div className="ab-philosophy-author">
                  <div className="ab-philosophy-line" />
                  <span>Michela</span>
                  <div className="ab-philosophy-line" />
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* ══ CTA ══ */}
      <section className="ab-cta-section">
        <Container>
          <div className={`ab-cta-wrap ab-fade ab-fade--up ${visible["cta"] ? "ab-fade--in" : ""}`} data-key="cta" ref={reg("cta")}>
            <span className="section-eyebrow">Inizia il tuo percorso</span>
            <h2 className="section-title w-50 mx-auto">Il tuo momento beauty ti aspetta!</h2>
            <p className="section-subtitle">Ti aspetto in Beauty Room per conoscerti e capire insieme quale trattamento fa per te.</p>
            <div className="ab-cta-btns">
              <button className="ab-btn-secondary" onClick={() => navigate("/trattamenti")}>
                Scopri i trattamenti
              </button>
              <button className="ab-btn-primary" onClick={() => navigate("/prodotti")}>
                Prodotti →
              </button>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
};

export default AboutDescription;
