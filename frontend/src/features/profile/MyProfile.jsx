import { useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { PersonCircle, EnvelopeFill, TelephoneFill, ShieldFillCheck, CalendarHeartFill, BagHeartFill } from "react-bootstrap-icons";
import { useNavigate } from "react-router-dom";
import EditProfileModal from "./EditProfileModal";
import ChangePasswordModal from "./ChangePasswordModal";
import { updateUser } from "../auth/slices/auth.slice";
import SEO from "../../components/common/SEO";

const MyProfile = () => {
  const { user } = useSelector(state => state.auth);
  const [openModal, setOpenModal] = useState(false);
  const [openPasswordModal, setOpenPasswordModal] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const name = user?.name || "Utente";
  const surname = user?.surname || "";
  const email = user?.email || "—";
  const phone = user?.phone || "Non inserito";
  const initials = `${(name?.[0] || "").toUpperCase()}${(surname?.[0] || "").toUpperCase()}`;

  const handleProfileUpdated = updatedUser => {
    dispatch(updateUser(updatedUser));
    setOpenModal(false);
  };

  return (
    <div className="mp-page">
      <SEO title="Il mio profilo" description="Gestisci il tuo account Beauty Room: dati personali, prenotazioni e ordini." noindex={true} />
      <Container>
        {/* HERO */}
        <div className="mp-hero">
          <div className="mp-avatar">{initials || "U"}</div>
          <div className="mp-hero-text">
            <p className="mp-eyebrow">Il tuo profilo</p>
            <h1 className="mp-name">
              {name} {surname}
            </h1>
            <p className="mp-member">Membro Beauty Room</p>
          </div>
        </div>

        {/* INFO CARDS */}
        <Row className="g-4 mb-4">
          <Col md={6}>
            <div className="mp-info-card">
              <div className="mp-info-icon">
                <EnvelopeFill />
              </div>
              <div>
                <p className="mp-info-label">Email</p>
                <p className="mp-info-value">{email}</p>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="mp-info-card">
              <div className="mp-info-icon">
                <TelephoneFill />
              </div>
              <div>
                <p className="mp-info-label">Telefono</p>
                <p className="mp-info-value">{phone}</p>
              </div>
            </div>
          </Col>
        </Row>

        {/* AZIONI */}
        <Row className="g-3 mb-5">
          <Col xs={12} sm={6} md={4}>
            <button className="mp-action-btn" onClick={() => setOpenModal(true)}>
              <PersonCircle className="mp-action-icon" />
              <span>Modifica profilo</span>
            </button>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <button className="mp-action-btn" onClick={() => setOpenPasswordModal(true)}>
              <ShieldFillCheck className="mp-action-icon" />
              <span>Cambia password</span>
            </button>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <a href="mailto:rossimichela.pmu@gmail.com?subject=Richiesta%20informazioni%20dal%20sito" className="mp-action-btn mp-action-btn--gold">
              <CalendarHeartFill className="mp-action-icon" />
              <span>Contatta Michela</span>
            </a>
          </Col>
        </Row>

        {/* SEZIONE ATTIVITÀ */}
        <div className="mp-section-title">
          <span className="section-eyebrow">La tua attività</span>
          <h2 className="mp-section-h2">I tuoi acquisti e prenotazioni</h2>
        </div>
        <Row className="g-4">
          <Col md={6}>
            <div className="mp-activity-card" onClick={() => navigate("/ordini")}>
              <BagHeartFill className="mp-activity-icon" />
              <div>
                <p className="mp-activity-label">I miei ordini</p>
                <p className="mp-activity-sub">Visualizza lo storico acquisti</p>
              </div>
              <span className="mp-activity-arrow">→</span>
            </div>
          </Col>
          <Col md={6}>
            <div className="mp-activity-card" onClick={() => (window.location.href = "/trattamenti")}>
              <CalendarHeartFill className="mp-activity-icon" />
              <div>
                <p className="mp-activity-label">Prenota un trattamento</p>
                <p className="mp-activity-sub">Scegli il tuo prossimo appuntamento</p>
              </div>
              <span className="mp-activity-arrow">→</span>
            </div>
          </Col>
        </Row>
      </Container>

      <EditProfileModal show={openModal} onHide={() => setOpenModal(false)} user={user} onProfileUpdated={handleProfileUpdated} />
      <ChangePasswordModal show={openPasswordModal} onHide={() => setOpenPasswordModal(false)} userId={user?.id} />
    </div>
  );
};

export default MyProfile;
