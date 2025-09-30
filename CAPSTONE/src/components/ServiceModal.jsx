import { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { createService, updateService } from "../api/api";
import { useSelector } from "react-redux";

const ServiceModal = ({ show, onHide, categories, onServiceSaved, service }) => {
  const { token } = useSelector(state => state.auth);

  const isEdit = Boolean(service);

  const [form, setForm] = useState({
    title: "",
    shortDescription: "",
    description: "",
    price: "",
    durationMin: "",
    categoryId: "",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setForm({
      title: "",
      shortDescription: "",
      description: "",
      price: "",
      durationMin: "",
      categoryId: "",
    });
    setFile(null);
    setErrors({});
  };

  useEffect(() => {
    if (isEdit) {
      setForm({
        title: service.title || "",
        shortDescription: service.shortDescription || "",
        description: service.description || "",
        price: service.price || "",
        durationMin: service.durationMin || "",
        categoryId: service.categoryName || "",
      });
    } else {
      resetForm();
    }
  }, [service, isEdit]);

  const validateField = (field, value) => {
    switch (field) {
      case "title":
        if (!value.trim()) return "Il titolo è obbligatorio.";
        break;
      case "shortDescription":
        if (!value.trim()) return "La breve descrizione è obbligatoria.";
        break;
      case "description":
        if (!value.trim()) return "La descrizione dettagliata è obbligatoria.";
        break;
      case "price":
        if (!value) return "Il prezzo è obbligatorio.";
        if (isNaN(value) || parseFloat(value) <= 0) return "Il prezzo deve essere un numero positivo.";
        break;
      case "durationMin":
        if (!value) return "La durata è obbligatoria.";
        if (isNaN(value) || parseInt(value) <= 0) return "La durata deve essere un numero positivo.";
        break;
      case "categoryId":
        if (!value) return "La categoria è obbligatoria.";
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

  const handleFileChange = e => {
    setFile(e.target.files[0]);
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

      const payload = {
        title: form.title,
        shortDescription: form.shortDescription,
        description: form.description,
        price: parseFloat(form.price),
        durationMin: parseInt(form.durationMin),
        categoryId: form.categoryId,
      };

      let savedService;
      if (isEdit) {
        savedService = await updateService(service.serviceId, payload, file, token);
      } else {
        savedService = await createService(payload, file, token);
        resetForm();
      }

      onServiceSaved(savedService);
      onHide();
    } catch (err) {
      setErrors({ general: err.message || "Errore durante il salvataggio." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? "Modifica Servizio" : "Aggiungi Servizio"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errors.general && <p className="text-danger">{errors.general}</p>}

        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Titolo *</Form.Label>
            <Form.Control type="text" value={form.title} onChange={e => handleChange("title", e.target.value)} isInvalid={!!errors.title} />
            <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Breve descrizione *</Form.Label>
            <Form.Control
              type="text"
              value={form.shortDescription}
              onChange={e => handleChange("shortDescription", e.target.value)}
              isInvalid={!!errors.shortDescription}
            />
            <Form.Control.Feedback type="invalid">{errors.shortDescription}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Descrizione dettagliata *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={form.description}
              onChange={e => handleChange("description", e.target.value)}
              isInvalid={!!errors.description}
            />
            <Form.Control.Feedback type="invalid">{errors.description}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Prezzo (€) *</Form.Label>
            <Form.Control type="number" value={form.price} onChange={e => handleChange("price", e.target.value)} isInvalid={!!errors.price} />
            <Form.Control.Feedback type="invalid">{errors.price}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Durata (min) *</Form.Label>
            <Form.Control type="number" value={form.durationMin} onChange={e => handleChange("durationMin", e.target.value)} isInvalid={!!errors.durationMin} />
            <Form.Control.Feedback type="invalid">{errors.durationMin}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Categoria *</Form.Label>
            <Form.Select value={form.categoryId} onChange={e => handleChange("categoryId", e.target.value)} isInvalid={!!errors.categoryId}>
              <option value="">-- Seleziona una categoria --</option>
              {categories.map(c => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.label}
                </option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">{errors.categoryId}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Immagine</Form.Label>

            {isEdit && service.images?.length > 0 && !file && (
              <small className="d-block text-muted mb-2">L'immagine attuale rimarrà se non ne carichi una nuova</small>
            )}

            <Form.Control type="file" accept="image/*" onChange={handleFileChange} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Chiudi
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner size="sm" animation="border" /> : isEdit ? "Salva modifiche" : "Crea"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ServiceModal;
