import { Container, Row, Col } from "react-bootstrap";
import { Facebook, Instagram, Whatsapp, GeoAlt, Envelope, Telephone } from "react-bootstrap-icons";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="br-footer" aria-label="Footer">
      <Container className="br-footer__container">
        <Row className="gy-4 text-center text-md-start align-items-start">
          <Col md={4} className="d-flex flex-column align-items-center align-items-md-start gap-2 justify-content-center">
            <div className="br-footer__title">Beauty Room</div>
            <div className="br-footer__subtitle">Trucco permanente • Laser • Estetica avanzata</div>

            <div className="br-footer__line">
              <GeoAlt className="br-footer__icon" />
              <span>Viale Risorgimento 587, Calusco d&apos;Adda (BG)</span>
            </div>

            <div className="br-footer__line">
              <Telephone className="br-footer__icon" />
              <a className="br-footer__link" href="tel:+393780921723">
                +39 378 092 1723
              </a>
              <span className="br-footer__dot">•</span>
              <a className="br-footer__link" href="https://wa.me/393780921723" target="_blank" rel="noreferrer noopener">
                WhatsApp
              </a>
            </div>

            <div className="br-footer__line">
              <Envelope className="br-footer__icon" />
              <a className="br-footer__link" href="mailto:rossimichela.pmu@gmail.com">
                rossimichela.pmu@gmail.com
              </a>
            </div>

            <div className="br-footer__muted">
              <strong>P. IVA:</strong> 04837370164
            </div>
          </Col>

          <Col md={4} className="d-flex flex-column align-items-center align-items-md-start">
            <div className="br-footer__sectionTitle">Orari</div>
            <ul className="br-footer__list">
              <li>
                <strong>Lunedì:</strong> solo prenotazioni
              </li>
              <li>
                <strong>Martedì:</strong> 9:00 - 16:00
              </li>
              <li>
                <strong>Mercoledì:</strong> 9:00 - 19:00
              </li>
              <li>
                <strong>Giovedì:</strong> 9:00 - 16:00
              </li>
              <li>
                <strong>Venerdì:</strong> 9:00 - 19:00
              </li>
              <li>
                <strong>Sabato:</strong> 9:00 - 14:30
              </li>
              <li>
                <strong>Domenica:</strong> Chiuso
              </li>
            </ul>
          </Col>

          <Col md={4} className="d-flex flex-column align-items-center align-items-md-start">
            <div className="br-footer__sectionTitle">Seguici</div>

            <div className="br-footer__social">
              <a
                className="br-footer__socialBtn"
                href="https://www.instagram.com/rossimichela.pmu"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Instagram"
              >
                <Instagram size={22} />
                <span>Instagram</span>
              </a>

              <a
                className="br-footer__socialBtn"
                href="https://www.facebook.com/rossimichela.pmu"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Facebook"
              >
                <Facebook size={22} />
                <span>Facebook</span>
              </a>

              <a className="br-footer__socialBtn" href="https://wa.me/393780921723" target="_blank" rel="noreferrer noopener" aria-label="WhatsApp">
                <Whatsapp size={22} />
                <span>WhatsApp</span>
              </a>
            </div>
          </Col>
        </Row>

        <div className="br-footer__bottom">
          <div className="br-footer__bottomRow">
            <small>© {year} Beauty Room — Tutti i diritti riservati</small>

            <div className="br-footer__legal">
              <a className="br-footer__link" href="/privacy">
                Privacy
              </a>
              <span className="br-footer__dot">•</span>
              <a className="br-footer__link" href="/cookie">
                Cookie
              </a>
              <span className="br-footer__dot">•</span>
              <a className="br-footer__link" href="/termini">
                Termini
              </a>
            </div>
          </div>

          <div className="br-footer__dev">
            <small>
              Sviluppato da <span className="br-footer__devName">Davide Rocca</span>
            </small>
          </div>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
