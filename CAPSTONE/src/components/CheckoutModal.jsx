import { useState } from "react";
import { Modal, Button, Form, Row, Col, Spinner } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { clearCart } from "../redux/action/cartActions";
import { createOrder } from "../api/api";
import { useNavigate } from "react-router-dom";

const CheckoutModal = ({ show, onHide, user }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items } = useSelector(state => state.cart);
  const { token } = useSelector(state => state.auth);

  const [form, setForm] = useState({
    customerName: "",
    customerSurname: "",
    customerEmail: "",
    customerPhone: "",
    address: "",
    city: "",
    zipCode: "",
    country: "Italia",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateField = (name, value) => {
    switch (name) {
      case "customerName":
        if (!value.trim()) return "Il nome è obbligatorio.";
        break;
      case "customerSurname":
        if (!value.trim()) return "Il cognome è obbligatorio.";
        break;
      case "customerEmail":
        if (!value.trim()) return "L'email è obbligatoria.";
        if (!/\S+@\S+\.\S+/.test(value)) return "Inserisci un'email valida.";
        break;
      case "customerPhone":
        if (!value.trim()) return "Il numero di telefono è obbligatorio.";
        if (!/^\+?[0-9]{7,15}$/.test(value)) return "Numero di telefono non valido.";
        break;
      case "address":
        if (!value.trim()) return "L'indirizzo è obbligatorio.";
        break;
      case "city":
        if (!value.trim()) return "La città è obbligatoria.";
        break;
      case "zipCode":
        if (!value.trim()) return "Il CAP è obbligatorio.";
        if (!/^\d{5}$/.test(value)) return "Il CAP deve avere 5 cifre.";
        break;
      case "country":
        if (!value.trim()) return "Il paese è obbligatorio.";
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

  const handleConfirm = async () => {
    if (!validateForm()) return;

    if (items.length === 0) {
      setErrors({ general: "Il carrello è vuoto." });
      return;
    }

    const payload = {
      ...form,
      userId: user?.id || null,
      items: items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    };

    try {
      setLoading(true);
      token ? await createOrder(payload, token) : await createOrder(payload);
      dispatch(clearCart());
      navigate("/ordine-confermato");
    } catch (err) {
      setErrors({ general: err.message || "Errore durante la creazione dell'ordine." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Procedi al Checkout</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {errors.general && <p className="text-danger">{errors.general}</p>}

        <Form>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Nome</Form.Label>
              <Form.Control name="customerName" value={form.customerName} onChange={handleChange} isInvalid={!!errors.customerName} />
              <Form.Control.Feedback type="invalid">{errors.customerName}</Form.Control.Feedback>
            </Col>
            <Col md={6}>
              <Form.Label>Cognome</Form.Label>
              <Form.Control name="customerSurname" value={form.customerSurname} onChange={handleChange} isInvalid={!!errors.customerSurname} />
              <Form.Control.Feedback type="invalid">{errors.customerSurname}</Form.Control.Feedback>
            </Col>
            <Col md={6}>
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" name="customerEmail" value={form.customerEmail} onChange={handleChange} isInvalid={!!errors.customerEmail} />
              <Form.Control.Feedback type="invalid">{errors.customerEmail}</Form.Control.Feedback>
            </Col>
            <Col md={6}>
              <Form.Label>Telefono</Form.Label>
              <Form.Control name="customerPhone" value={form.customerPhone} onChange={handleChange} placeholder="+39..." isInvalid={!!errors.customerPhone} />
              <Form.Control.Feedback type="invalid">{errors.customerPhone}</Form.Control.Feedback>
            </Col>
            <Col md={12}>
              <Form.Label>Indirizzo</Form.Label>
              <Form.Control name="address" value={form.address} onChange={handleChange} isInvalid={!!errors.address} />
              <Form.Control.Feedback type="invalid">{errors.address}</Form.Control.Feedback>
            </Col>
            <Col md={4}>
              <Form.Label>Città</Form.Label>
              <Form.Control name="city" value={form.city} onChange={handleChange} isInvalid={!!errors.city} />
              <Form.Control.Feedback type="invalid">{errors.city}</Form.Control.Feedback>
            </Col>
            <Col md={4}>
              <Form.Label>CAP</Form.Label>
              <Form.Control name="zipCode" value={form.zipCode} onChange={handleChange} isInvalid={!!errors.zipCode} />
              <Form.Control.Feedback type="invalid">{errors.zipCode}</Form.Control.Feedback>
            </Col>
            <Col md={4}>
              <Form.Label>Paese</Form.Label>
              <Form.Control name="country" value={form.country} onChange={handleChange} isInvalid={!!errors.country} />
              <Form.Control.Feedback type="invalid">{errors.country}</Form.Control.Feedback>
            </Col>
          </Row>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Annulla
        </Button>
        <Button variant="success" onClick={handleConfirm} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : "Conferma Ordine"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CheckoutModal;
