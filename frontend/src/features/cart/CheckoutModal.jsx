import { useState } from "react";
import { Modal, Button, Form, Row, Col, Spinner, Alert } from "react-bootstrap";

const CheckoutModal = ({ show, onHide, cartItems, totalPrice, onConfirm }) => {
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    phone: "",
    pickupNote: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);

  // ---------- VALIDAZIONE ----------
  const validateField = (name, value) => {
    switch (name) {
      case "name":
        if (!value.trim()) return "Il nome è obbligatorio.";
        break;
      case "surname":
        if (!value.trim()) return "Il cognome è obbligatorio.";
        break;
      case "email":
        if (!/\S+@\S+\.\S+/.test(value)) return "Inserisci un'email valida.";
        break;
      case "phone":
        if (!/^\+?[0-9]{7,15}$/.test(value)) return "Numero di telefono non valido.";
        break;
      default:
        return null;
    }
    return null;
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
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

  // ---------- PAGAMENTO ----------
  const handleSubmit = async e => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) return;
    setLoading(true);

    const orderData = {
      customerName: form.name,
      customerSurname: form.surname,
      customerEmail: form.email,
      customerPhone: form.phone,
      pickupNote: form.pickupNote || null,
      items: cartItems.map(i => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      totalAmount: totalPrice,
    };

    try {
      await onConfirm(orderData);
      onHide();
    } catch (err) {
      console.error("Errore pagamento:", err);
      setServerError(err.message || "Si è verificato un errore durante il pagamento.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- UI ----------
  return (
    <Modal show={show} onHide={onHide} centered size="lg" backdrop="static">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Completa i tuoi dati per il pagamento</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {serverError && (
            <Alert variant="danger" onClose={() => setServerError(null)} dismissible>
              {serverError}
            </Alert>
          )}

          <p className="text-muted mb-4">
            Inserisci i tuoi dati per completare il checkout come ospite.
            <br />
            <strong>Totale ordine: € {totalPrice.toFixed(2)}</strong>
          </p>

          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Nome *</Form.Label>
              <Form.Control name="name" value={form.name} onChange={handleChange} isInvalid={!!errors.name} disabled={loading} />
              <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
            </Col>

            <Col md={6}>
              <Form.Label>Cognome *</Form.Label>
              <Form.Control name="surname" value={form.surname} onChange={handleChange} isInvalid={!!errors.surname} disabled={loading} />
              <Form.Control.Feedback type="invalid">{errors.surname}</Form.Control.Feedback>
            </Col>

            <Col md={6}>
              <Form.Label>Email *</Form.Label>
              <Form.Control type="email" name="email" value={form.email} onChange={handleChange} isInvalid={!!errors.email} disabled={loading} />
              <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
            </Col>

            <Col md={6}>
              <Form.Label>Telefono *</Form.Label>
              <Form.Control
                type="tel"
                name="phone"
                placeholder="+39..."
                value={form.phone}
                onChange={handleChange}
                isInvalid={!!errors.phone}
                disabled={loading}
              />
              <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
            </Col>

            <Col md={12}>
              <Form.Label>Quando vuoi ritirare il tuo ordine? (opzionale)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                name="pickupNote"
                value={form.pickupNote}
                onChange={handleChange}
                disabled={loading}
                placeholder="Es: Passo domani pomeriggio, grazie!"
              />
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer className="d-flex justify-content-between">
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            Annulla
          </Button>

          <Button variant="success" size="lg" type="submit" disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : "Procedi al pagamento"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CheckoutModal;
