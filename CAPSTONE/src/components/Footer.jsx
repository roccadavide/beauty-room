import { Container, Row, Col } from "react-bootstrap";
import { Facebook, Instagram, Whatsapp } from "react-bootstrap-icons";

const Footer = () => {
  return (
    <footer className="footer mt-5">
      <div className="map-container w-100" style={{ height: "350px" }}>
        <iframe
          title="Mappa Beauty Room"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2736.0993920298256!2d9.462541476226559!3d45.692932671078665!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4786ada52f162efd%3A0xcebdea647a990fce!2sBeauty%20room!5e1!3m2!1sit!2sit!4v1755613292689!5m2!1sit!2sit"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen=""
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>

      <div className="footer-bottom py-4 bg-dark text-light">
        <Container>
          <Row className="text-center text-md-start">
            <Col md={4} className="mb-3 mb-md-0 d-flex flex-column align-items-center justify-content-between">
              <h1>
                <strong>Beauty Room</strong>
              </h1>
              <p>Viale Risorgimento 587, Calusco d'Adda BG</p>
              <p>
                <strong>Tel:</strong>
                <a href="https://wa.me/393780921723" target="_blank" className="text-light">
                  +39 378 0921723
                </a>
              </p>

              <p>
                <strong>Email: </strong>
                <a href="mailto:rossimichela.pmu@gmail.com" className="text-light">
                  rossimichela.pmu@gmail.com
                </a>
              </p>
              <p>
                <strong>P. Iva:</strong> 04837370164
              </p>
            </Col>

            <Col md={4} className="mb-3 mb-md-0 d-flex flex-column align-items-center">
              <h1>
                <strong>Orari</strong>
              </h1>
              <p>
                <strong>Lunedì:</strong> solo prenotazioni
              </p>
              <p>
                <strong>Martedì:</strong> 9.00 - 16.00
              </p>
              <p>
                <strong>Mercoledì:</strong> 9.00 - 19.00
              </p>
              <p>
                <strong>Giovedì:</strong> 9.00 - 16.00
              </p>
              <p>
                <strong>Venerdì:</strong> 9:00 - 19:00
              </p>
              <p>
                <strong>Sabato:</strong> 9:00 - 14:30
              </p>
              <p>
                <strong>Domenica:</strong> Chiuso
              </p>
            </Col>

            <Col md={4} className="d-flex flex-column align-items-center">
              <h1>
                <strong>Seguici</strong>
              </h1>
              <div className="d-flex justify-content-center justify-content-md-start gap-5 mt-3">
                <a href="https://www.facebook.com/rossimichela.pmu" target="_blank" className="text-light">
                  <Facebook size={50} />
                </a>
                <a
                  href="https://www.instagram.com/rossimichela.pmu?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                  target="_blank"
                  className="text-light"
                >
                  <Instagram size={50} />
                </a>
                <a href="https://wa.me/393780921723" target="_blank" className="text-light">
                  <Whatsapp size={50} />
                </a>
              </div>
            </Col>
          </Row>

          <Row className="pt-3 mt-3 border-top border-secondary">
            <Col className="text-center">
              <small>© {new Date().getFullYear()} Beauty Room - Tutti i diritti riservati</small>
            </Col>
          </Row>
        </Container>
      </div>
    </footer>
  );
};

export default Footer;
