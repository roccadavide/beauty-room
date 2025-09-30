import { useEffect, useRef, useState } from "react";
import { Container, Row, Col, Card } from "react-bootstrap";

const AboutDescription = () => {
  const sectionsRef = useRef([]);
  const [visibleSections, setVisibleSections] = useState({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => ({ ...prev, [entry.target.dataset.id]: true }));
          }
        });
      },
      { threshold: 0.25 }
    );

    sectionsRef.current.forEach(sec => sec && observer.observe(sec));
    return () => sectionsRef.current.forEach(sec => sec && observer.unobserve(sec));
  }, []);

  return (
    <Container fluid className="about-root py-5">
      <Row className="justify-content-center text-center mb-5">
        <Col md={9}>
          <h1 className="fw-bold about-title">Chi Sono</h1>
          <p className="lead about-subtitle">
            Ciao, sono <strong>Michela</strong>, fondatrice di <em>Beauty Room</em>. Un luogo accogliente dove estetica e benessere si incontrano con cura e
            professionalità.
          </p>
          <hr className="about-hr" />
        </Col>
      </Row>

      <Row className="align-items-center mb-5 g-4">
        <Col md={6}>
          <div data-id="bio" ref={el => (sectionsRef.current[0] = el)} className={`fade-section ${visibleSections["bio"] ? "visible" : ""}`}>
            <h2 className="section-heading">La mia storia</h2>
            <p className="mb-3">
              Da anni mi dedico al mondo beauty con formazione continua, per offrire trattamenti aggiornati, efficaci e sicuri. La passione per i dettagli e
              l’ascolto delle persone mi hanno spinta a creare un ambiente caldo, rilassante e su misura per ogni cliente.
            </p>
            <p className="mb-0">Il mio obiettivo? Farti uscire più serena di come sei entrata — con un risultato naturale, curato, tuo.</p>
          </div>
        </Col>
        <Col md={6} className="text-center">
          <div className="about-image-wrap fade-section visible">
            <img src="/chisono-michela.jpeg" alt="Michela" className="about-image" />
          </div>
        </Col>
      </Row>

      {/* COMPETENZE */}
      <Row className="mb-5">
        <Col>
          <div data-id="skills" ref={el => (sectionsRef.current[1] = el)} className={`fade-section text-center ${visibleSections["skills"] ? "visible" : ""}`}>
            <h2 className="section-heading mb-4">Competenze</h2>
            <div className="chips">
              <span className="chip">Trattamenti viso</span>
              <span className="chip chip-alt">Massaggi rilassanti</span>
              <span className="chip">Manicure & Pedicure</span>
              <span className="chip chip-alt">Epilazione</span>
              <span className="chip">Make-up personalizzato</span>
            </div>
          </div>
        </Col>
      </Row>

      {/* VALORI */}
      <Row className="g-4 mb-5">
        {[
          { icon: "💆‍♀️", title: "Cura", text: "Trattamenti su misura e attenzione autentica alla persona." },
          { icon: "🌿", title: "Benessere", text: "Un’esperienza che rilassa corpo e mente, oltre al risultato estetico." },
          { icon: "💄", title: "Stile", text: "Look naturali e armoniosi, valorizzando la tua unicità." },
        ].map((v, i) => (
          <Col md={4} key={v.title}>
            <Card
              data-id={`value-${i}`}
              ref={el => (sectionsRef.current[2 + i] = el)}
              className={`soft-card fade-section ${visibleSections[`value-${i}`] ? "visible" : ""}`}
            >
              <Card.Body>
                <div className="value-icon">{v.icon}</div>
                <Card.Title className="mb-2">{v.title}</Card.Title>
                <Card.Text className="mb-0">{v.text}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* FILOSOFIA */}
      <Row className="justify-content-center">
        <Col md={9}>
          <div data-id="mission" ref={el => (sectionsRef.current[5] = el)} className={`fade-section ${visibleSections["mission"] ? "visible" : ""}`}>
            <Card className="soft-card p-4 border-0">
              <h2 className="section-heading mb-3">La mia filosofia</h2>
              <p className="mb-0">
                Ogni persona merita un momento per sé. Per questo i miei trattamenti sono rituali di benessere pensati per rigenerarti: risultati curati, tempi
                rispettosi e un’atmosfera che profuma di casa.
              </p>
            </Card>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default AboutDescription;
