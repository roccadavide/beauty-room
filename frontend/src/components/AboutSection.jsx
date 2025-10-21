import { Button, Col, Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

const AboutSection = () => {
  return (
    <section className="about-section py-5">
      <Container fluid className="p-5">
        <Row className="align-items-center">
          <Col md={6} className="p-0 col-img">
            <img src="/negoziomichi.jpeg" alt="Negozio Michela" className="img-fluid w-100 h-100 object-fit-cover" />
          </Col>
          <Col md={6} className="d-flex justify-content-center align-items-center col-desc">
            <div className="about-box p-4 p-md-5 text-center text-md-start">
              <h2 className="mb-3">Il Negozio di Michela</h2>
              <p className="mb-4">
                Vieni a scoprire il mondo Beauty Room, dove estetica e benessere si incontrano. Michela ti guiderà con professionalità e passione verso il tuo
                percorso di bellezza e relax.
              </p>
              <Link to="/chisono">
                <Button variant="dark" className="rounded-pill px-4 py-2">
                  Scopri di più
                </Button>
              </Link>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default AboutSection;
