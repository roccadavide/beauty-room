import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { createStaff } from "../../../api/modules/team.api";

/*
 * Create-staff form. Mirrors the NewStaffMemberDTO contract (displayName, email,
 * password, phone, optional color). react-bootstrap Modal renders in a portal at
 * document.body, so it is safe under PageTransition's containing block.
 *
 * A duplicate email/phone returns 409 → surfaced inline (no toast).
 */

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;

const EMPTY = { displayName: "", email: "", password: "", phone: "", color: "#c9a24b" };

export default function StaffFormModal({ show, onHide, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: null }));
    setServerError("");
  };

  const reset = () => {
    setForm(EMPTY);
    setErrors({});
    setServerError("");
  };

  const validate = () => {
    const e = {};
    if (form.displayName.trim().length < 2) e.displayName = "Nome troppo corto (min 2).";
    if (!emailRegex.test(form.email)) e.email = "Email non valida.";
    if (form.password.length < 6) e.password = "Password troppo corta (min 6).";
    if (!phoneRegex.test(form.phone)) e.phone = "Telefono non valido.";
    return e;
  };

  const handleSubmit = async () => {
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setSaving(true);
    setServerError("");
    try {
      const created = await createStaff({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        color: form.color || null,
      });
      reset();
      onCreated(created);
    } catch (err) {
      setServerError(err.message || "Errore durante la creazione.");
    } finally {
      setSaving(false);
    }
  };

  const handleHide = () => {
    if (saving) return;
    reset();
    onHide();
  };

  return (
    <Modal show={show} onHide={handleHide} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Nuovo membro del team</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="d-grid gap-3">
          <Form.Group>
            <Form.Label>Nome visualizzato</Form.Label>
            <Form.Control
              value={form.displayName}
              onChange={e => setField("displayName", e.target.value)}
              isInvalid={!!errors.displayName}
              placeholder="es. Giulia"
              maxLength={80}
            />
            <Form.Control.Feedback type="invalid">{errors.displayName}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group>
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={form.email}
              onChange={e => setField("email", e.target.value)}
              isInvalid={!!errors.email}
              placeholder="email@esempio.it"
              autoComplete="off"
            />
            <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group>
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={form.password}
              onChange={e => setField("password", e.target.value)}
              isInvalid={!!errors.password}
              placeholder="Almeno 6 caratteri"
              autoComplete="new-password"
            />
            <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group>
            <Form.Label>Telefono</Form.Label>
            <Form.Control
              value={form.phone}
              onChange={e => setField("phone", e.target.value)}
              isInvalid={!!errors.phone}
              placeholder="+39…"
            />
            <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group>
            <Form.Label>Colore agenda</Form.Label>
            <div className="team-color-row">
              <Form.Control
                type="color"
                value={form.color}
                onChange={e => setField("color", e.target.value)}
                className="team-color-input"
                title="Colore accento agenda"
              />
              <span className="team-color-value">{form.color}</span>
            </div>
          </Form.Group>

          {serverError && <div className="server-error" role="alert">{serverError}</div>}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleHide} disabled={saving}>
          Annulla
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "Creazione…" : "Crea membro"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
