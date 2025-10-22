import { Container, Row, Col, Card } from "react-bootstrap";
import { useEffect, useRef, useState } from "react";

const AcademySection = () => {
  const cardsRef = useRef([]);
  const [visible, setVisible] = useState({});

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisible(prev => ({ ...prev, [entry.target.dataset.id]: true }));
          }
        });
      },
      { threshold: 0.2 }
    );

    cardsRef.current.forEach(el => el && obs.observe(el));

    return () => {
      cardsRef.current.forEach(el => el && obs.unobserve(el));
    };
  }, []);

  const ACADEMIES = [
    {
      id: "a1",
      title: "My Beauty Accademy",
      img: "/logo-my.png",
      desc: "Specializzazione in trattamenti viso e corpo.",
      link: "https://mybeautyacademy.it/",
    },
    {
      id: "a2",
      title: "PhiAccademy",
      img: "/phiaccademy.jpg",
      desc: "Tecniche avanzate di trucco permanente.",
      link: "https://www.phi-academy.com/it-it",
    },
    {
      id: "a3",
      title: "Kalentin Training Academy",
      img: "/kalentin.png",
      desc: "Formazione completa in estetica professionale.",
      link: "https://kalentin.com/it/?gad_source=1&gad_campaignid=22712081003&gbraid=0AAAAADXU_E87ii9autOgH3gIXFmS_dbqK&gclid=CjwKCAjw_-3GBhAYEiwAjh9fUCDFxnNhhb08KJgbIm0deDkuBV4uQZXfsbkCnLSSTcDzsKLRpCzrFBoCwVwQAvD_BwE",
    },
  ];

  return (
    <Container fluid className="py-5 academy-root">
      <h2 className="text-center mb-3 fw-bold">Le mie Accademie</h2>
      <p className="text-center text-muted mb-5">Una selezione di percorsi formativi che hanno arricchito le mie competenze professionali.</p>

      <Row className="g-4 justify-content-center">
        {ACADEMIES.map((a, idx) => (
          <Col key={a.id} xs={12} sm={6} md={4} lg={3} className="d-flex justify-content-center">
            <Card
              data-id={a.id}
              ref={el => (cardsRef.current[idx] = el)}
              className={`academy-card shadow-sm border-0 rounded-4 ${visible[a.id] ? "visible" : ""}`}
              onClick={() => window.open(a.link, "_blank")}
            >
              <Card.Img src={a.img} alt={a.title} className="academy-img rounded-top-4" />
              <Card.Body>
                <Card.Title className="fw-semibold">{a.title}</Card.Title>
                <Card.Text className="small text-muted">{a.desc}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default AcademySection;
