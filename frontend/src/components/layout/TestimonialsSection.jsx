import { Container, Row, Col, Card } from "react-bootstrap";
import { useEffect, useRef, useState } from "react";
import { StarFill } from "react-bootstrap-icons";

const TestimonialsSection = () => {
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

  const TESTIMONIALS = [
    {
      id: 1,
      name: "Cliente Fissa",
      review:
        "Locale curato nei dettagli, moderno, accogliente e pulito. Michela è molto professionale e gentile, mette il cliente a proprio agio, si vede quanto ami il proprio lavoro. Ormai sono cliente fissa! Oltre all'estetica base offre trattamenti specifici viso e corpo. Esegue anche trucco permanente. Io infatti mi sono affidata a lei per trucco permanente di sopracciglia e labbra con risultati favolosi senza stravolgere la naturalezza del volto. Sono molto soddisfatta!",
      rating: 5,
    },
    {
      id: 2,
      name: "Cliente Soddisfatta",
      review:
        "Ho provato un po' di trattamenti da Michela e da collega mi sono sempre trovata molto bene. Ho effettuato massaggio, epilazione e trattamento viso con tecnologia Needling che era proprio quello che cercavo e che consiglio vivamente di provare; é davvero stimolante, soddisfacente e i risultati sono ottimali e visibili fin dalla prima seduta. Michela é una ragazza molto gentile, alla mano, professionale e che ama il suo lavoro. È sempre un piacere scambiare due chiacchiere con lei. Proverò sicuramente anche gli altri trattamenti che offre visto l'ottimo rapporto qualità-prezzo.",
      rating: 5,
    },
    {
      id: 3,
      name: "Cliente Benessere",
      review:
        "Da Michela ho fatto trattamenti mirati per il mio benessere fisico, tra massaggi e laminazione ciglia e colorazione sopracciglia, semipermanente mani e piedi tutto eseguito con precisione e professionalità da una ragazza brillante e molto preparata! Grazie Michi per prenderti cura di me!",
      rating: 5,
    },
    {
      id: 4,
      name: "Cliente Laminazione",
      review:
        "Bellissimo posto e super accogliente. Michela gentilissima e con un sacco di passione nel suo lavoro. Ho fatto il trattamento della laminazione ciglia e sopracciglia, il risultato molto soddisfacente e prezzi onesti.",
      rating: 5,
    },
  ];

  return (
    <Container fluid className="py-5 testimonials-root">
      <h2 className="text-center mb-3 fw-bold">Cosa dicono i clienti</h2>
      <p className="text-center text-muted mb-5">Alcune testimonianze reali dalle persone che hanno scelto Beauty Room.</p>

      <Row className="g-4 justify-content-evenly">
        {TESTIMONIALS.map((t, idx) => (
          <Col key={t.id} xs={12} sm={6} md={4} lg={3} className="d-flex justify-content-center">
            <Card
              data-id={t.id}
              ref={el => (cardsRef.current[idx] = el)}
              className={`testimonial-card shadow-sm border-0 rounded-4 p-3 ${visible[t.id] ? "visible" : ""}`}
            >
              <Card.Body>
                <div className="mb-2 text-warning text-center">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <StarFill key={i} className="me-1" />
                  ))}
                </div>
                <Card.Text className="fst-italic small text-muted">“{t.review}”</Card.Text>
                <Card.Title className="mt-3 mb-0 text-end fw-semibold">— {t.name}</Card.Title>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      <div className="text-center mt-5">
        <a
          href="https://www.google.com/search?sa=X&sca_esv=bf7843588f50460d&hl=it&gl=IT&biw=1440&bih=740&tbm=lcl&sxsrf=AE3TifOZZzoZT7nTwedSI0YbrUF3p_J8nw:1759226687219&q=Beauty%20room%20Recensioni&rflfq=1&num=20&stick=H4sIAAAAAAAAAONgkxIxNLGwNDc2MrAwtTQDYhNLY0uDDYyMrxjFnFITS0sqFYry83MVglKTU_OKM_PzMhex4pAAAPVmQURNAAAA&rldimm=14897320859685949390&ved=0CBAQ5foLahcKEwjIpruOnoCQAxUAAAAAHQAAAAAQBQ#lkt=LocalPoiReviews&arid=Ci9DQUlRQUNvZENodHljRjlvT21WVGJXb3dVMFZ6UmtGSlZWSnlTa05ZVHpoVE5GRRAB"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-dark rounded-pill px-4"
        >
          Vedi tutte le recensioni su Google →
        </a>
      </div>
    </Container>
  );
};

export default TestimonialsSection;
