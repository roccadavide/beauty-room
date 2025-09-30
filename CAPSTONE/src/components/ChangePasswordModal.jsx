import { useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { patchPassword } from "../api/api";

const ChangePasswordModal = ({ show, onHide, userId }) => {
  const { token } = useSelector(state => state.auth);

  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.oldPassword.trim()) newErrors.oldPassword = "La vecchia password è obbligatoria.";
    if (!form.newPassword.trim()) newErrors.newPassword = "La nuova password è obbligatoria.";
    else if (form.newPassword.length < 8) newErrors.newPassword = "La nuova password deve avere almeno 8 caratteri.";
    if (!form.confirmNewPassword.trim()) newErrors.confirmNewPassword = "La conferma è obbligatoria.";
    else if (form.newPassword !== form.confirmNewPassword) newErrors.confirmNewPassword = "Le password non coincidono.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      await patchPassword(form, userId, token);
      onHide();
      setForm({ oldPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setErrors({ general: err.message || "Errore durante l'aggiornamento della password." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Cambia password</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errors.general && <p className="text-danger">{errors.general}</p>}

        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Vecchia password *</Form.Label>
            <Form.Control
              type="password"
              value={form.oldPassword}
              onChange={e => handleChange("oldPassword", e.target.value)}
              isInvalid={!!errors.oldPassword}
            />
            <Form.Control.Feedback type="invalid">{errors.oldPassword}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Nuova password *</Form.Label>
            <Form.Control
              type="password"
              value={form.newPassword}
              onChange={e => handleChange("newPassword", e.target.value)}
              isInvalid={!!errors.newPassword}
            />
            <Form.Control.Feedback type="invalid">{errors.newPassword}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Conferma nuova password *</Form.Label>
            <Form.Control
              type="password"
              value={form.confirmNewPassword}
              onChange={e => handleChange("confirmNewPassword", e.target.value)}
              isInvalid={!!errors.confirmNewPassword}
            />
            <Form.Control.Feedback type="invalid">{errors.confirmNewPassword}</Form.Control.Feedback>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Chiudi
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner size="sm" animation="border" /> : "Aggiorna password"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ChangePasswordModal;
