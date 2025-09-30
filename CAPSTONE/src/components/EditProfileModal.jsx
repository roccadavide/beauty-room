import { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { updateUser } from "../api/api";
import { useSelector } from "react-redux";

const EditProfileModal = ({ show, onHide, user, onProfileUpdated }) => {
  const { token } = useSelector(state => state.auth);
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        surname: user.surname || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user, show]);

  const validateField = (field, value) => {
    switch (field) {
      case "name":
      case "surname":
        if (!value.trim()) return "Campo obbligatorio.";
        break;
      case "email":
        if (!value.trim()) return "Email obbligatoria.";
        if (!/\S+@\S+\.\S+/.test(value)) return "Formato email non valido.";
        break;
      case "phone":
        if (!value.trim()) return "Telefono obbligatorio.";
        if (!/^[0-9+\s-]+$/.test(value)) return "Formato telefono non valido.";
        break;
      default:
        return null;
    }
    return null;
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(form).forEach(key => {
      const error = validateField(key, form[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const updated = await updateUser(form, user.id, token);
      onProfileUpdated(updated);

      onHide();
    } catch (err) {
      setErrors({ general: err.message || "Errore durante l'aggiornamento." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Modifica profilo</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errors.general && <p className="text-danger">{errors.general}</p>}

        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Nome *</Form.Label>
            <Form.Control type="text" value={form.name} onChange={e => handleChange("name", e.target.value)} isInvalid={!!errors.name} />
            <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Cognome *</Form.Label>
            <Form.Control type="text" value={form.surname} onChange={e => handleChange("surname", e.target.value)} isInvalid={!!errors.surname} />
            <Form.Control.Feedback type="invalid">{errors.surname}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email *</Form.Label>
            <Form.Control type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} isInvalid={!!errors.email} />
            <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Telefono *</Form.Label>
            <Form.Control type="text" value={form.phone} onChange={e => handleChange("phone", e.target.value)} isInvalid={!!errors.phone} />
            <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Chiudi
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner size="sm" animation="border" /> : "Salva modifiche"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EditProfileModal;
