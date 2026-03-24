import { useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { patchPassword } from "../../api/modules/users.api";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";

const ChangePasswordModal = ({ show, onHide, userId }) => {
  const { accessToken } = useSelector(state => state.auth);

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
      await patchPassword(form, userId, accessToken);
      onHide();
      setForm({ oldPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setErrors({ general: err.message || "Errore durante l'aggiornamento della password." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <UnifiedDrawer
      show={show}
      onHide={onHide}
      title="Cambia password"
      size="sm"
      footer={
        <div className="ud-footer-actions">
          <button type="button" className="bm-btn bm-btn--ghost" onClick={onHide} disabled={loading}>
            Chiudi
          </button>
          <button type="button" className="bm-btn bm-btn--primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size="sm" animation="border" /> : "Aggiorna password"}
          </button>
        </div>
      }
    >
      {errors.general && <p className="ud-error">{errors.general}</p>}

      <Form className="d-flex flex-column gap-3">
        <Form.Group>
          <Form.Label>Vecchia password *</Form.Label>
          <Form.Control
            type="password"
            value={form.oldPassword}
            onChange={e => handleChange("oldPassword", e.target.value)}
            isInvalid={!!errors.oldPassword}
          />
          <Form.Control.Feedback type="invalid">{errors.oldPassword}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group>
          <Form.Label>Nuova password *</Form.Label>
          <Form.Control
            type="password"
            value={form.newPassword}
            onChange={e => handleChange("newPassword", e.target.value)}
            isInvalid={!!errors.newPassword}
          />
          <Form.Control.Feedback type="invalid">{errors.newPassword}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group>
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
    </UnifiedDrawer>
  );
};

export default ChangePasswordModal;
