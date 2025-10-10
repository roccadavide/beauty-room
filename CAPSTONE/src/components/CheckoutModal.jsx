import { useState } from "react";
import { Modal, Button, Form, Row, Col, Spinner } from "react-bootstrap";

const CheckoutModal = ({ show, onHide, cartItems, totalPrice, onConfirm }) => {
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    phone: "",
    pickupNote: "",
  });

  const [errors, setErrors] = useState({});
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
    setForm({ ...form, [name]: value });
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
  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);

    const orderData = {
      fullName: `${form.name} ${form.surname}`,
      email: form.email,
      phone: form.phone,
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
      alert("Errore durante il pagamento: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- UI ----------
  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Completa i tuoi dati per il pagamento</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Nome *</Form.Label>
              <Form.Control name="name" value={form.name} onChange={handleChange} isInvalid={!!errors.name} />
              <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
            </Col>

            <Col md={6}>
              <Form.Label>Cognome *</Form.Label>
              <Form.Control name="surname" value={form.surname} onChange={handleChange} isInvalid={!!errors.surname} />
              <Form.Control.Feedback type="invalid">{errors.surname}</Form.Control.Feedback>
            </Col>

            <Col md={6}>
              <Form.Label>Email *</Form.Label>
              <Form.Control type="email" name="email" value={form.email} onChange={handleChange} isInvalid={!!errors.email} />
              <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
            </Col>

            <Col md={6}>
              <Form.Label>Telefono *</Form.Label>
              <Form.Control name="phone" value={form.phone} onChange={handleChange} placeholder="+39..." isInvalid={!!errors.phone} />
              <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
            </Col>

            <Col md={12}>
              <Form.Label>Quando vuoi ritirare il tuo ordine? (opzionale)</Form.Label>
              <Form.Control
                as="textarea"
                name="pickupNote"
                value={form.pickupNote}
                onChange={handleChange}
                placeholder="Es: Passo domani pomeriggio, grazie!"
                rows={2}
              />
            </Col>
          </Row>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Annulla
        </Button>
        <Button variant="success" size="lg" onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : "Procedi al pagamento"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CheckoutModal;
