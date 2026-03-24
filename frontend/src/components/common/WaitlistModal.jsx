import { useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import { joinWaitlist } from "../../api/modules/waitlist.api";
import UnifiedDrawer from "./UnifiedDrawer";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;

/**
 * Drawer che si apre quando la cliente clicca su uno slot occupato.
 * Props:
 *  - show: boolean
 *  - onHide: fn
 *  - service: { serviceId, title }
 *  - date: Date
 *  - slot: { start, end }
 */
export default function WaitlistModal({ show, onHide, service, date, slot }) {
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [phone, setPhone]   = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [apiError, setApiError] = useState("");

  const reset = () => {
    setName(""); setEmail(""); setPhone("");
    setErrors({}); setSuccess(null); setApiError("");
  };

  const handleClose = () => { onHide(); reset(); };

  const validate = () => {
    const e = {};
    if (!name.trim())            e.name  = "Nome obbligatorio";
    if (!emailRegex.test(email)) e.email = "Email non valida";
    if (!phoneRegex.test(phone)) e.phone = "Telefono non valido";
    return e;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError("");
    try {
      const day = date.toLocaleDateString("sv-SE");
      const result = await joinWaitlist({
        serviceId:     service.serviceId,
        requestedDate: day,
        requestedTime: slot.start + ":00",
        customerName:  name.trim(),
        customerEmail: email.trim().toLowerCase(),
        customerPhone: phone.trim(),
      });
      setSuccess(result);
    } catch (e) {
      setApiError(e?.response?.data?.message || e.message || "Errore. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const dateStr = date?.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <UnifiedDrawer
      show={show}
      onHide={handleClose}
      title="Lista d'attesa"
      size="sm"
    >
      {success ? (
        <div className="wl-success">
          <div className="wl-success__icon">🎉</div>
          <div className="wl-success__title">Sei in lista!</div>
          <p className="wl-success__text">
            Ti avviseremo via email non appena lo slot si libera.<br />
            Sarai la <strong>n°{success.positionInQueue}</strong> in lista.
          </p>
          <div className="wl-success__slot">
            <span>📅 {dateStr}</span>
            <span>🕐 {slot?.start}</span>
          </div>
          <button className="bm-btn bm-btn--primary" onClick={handleClose} type="button">
            Chiudi
          </button>
        </div>
      ) : (
        <div className="bm-step-content">
          <div className="wl-slot-info">
            <div className="wl-slot-badge">🔒 Slot occupato</div>
            <div className="wl-slot-detail">
              <span>📅 {dateStr}</span>
              <span>🕐 {slot?.start} – {slot?.end}</span>
            </div>
            <p className="wl-slot-desc">
              Questo orario è al momento occupato. Lascia i tuoi dati:
              ti avvisiamo subito via email se si libera e avrai
              <strong> 2 ore</strong> per confermare.
            </p>
          </div>

          {apiError && <div className="bm-alert">{apiError}</div>}

          <Form className="bm-form">
            <Form.Group className="bm-form-group">
              <Form.Label>Nome e Cognome *</Form.Label>
              <Form.Control
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: null })); }}
                isInvalid={!!errors.name}
                className="bm-input"
                placeholder="Es. Giulia Rossi"
              />
              <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="bm-form-group">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: null })); }}
                isInvalid={!!errors.email}
                className="bm-input"
                placeholder="nome@email.com"
              />
              <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="bm-form-group">
              <Form.Label>Telefono *</Form.Label>
              <Form.Control
                value={phone}
                onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: null })); }}
                isInvalid={!!errors.phone}
                className="bm-input"
                placeholder="+39 333 1234567"
              />
              <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
            </Form.Group>
          </Form>

          <div className="bm-nav">
            <button className="bm-btn bm-btn--ghost" type="button" onClick={handleClose}>
              Annulla
            </button>
            <button
              className="bm-btn bm-btn--primary"
              type="button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <Spinner size="sm" animation="border" /> : "Iscriviti alla lista"}
            </button>
          </div>
        </div>
      )}
    </UnifiedDrawer>
  );
}
