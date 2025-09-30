import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { createResult, updateResult } from "../api/api";
import { useSelector } from "react-redux";
import { useEffect, useState } from "react";

const ResultModal = ({ show, onHide, categories, onResultSaved, result }) => {
  const { token } = useSelector(state => state.auth);

  const isEdit = Boolean(result);

  const [form, setForm] = useState({
    title: "",
    shortDescription: "",
    description: "",
    date: "",
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
      date: "",
      categoryId: "",
    });
    setFile(null);
    setErrors({});
  };

  useEffect(() => {
    if (isEdit) {
      setForm({
        title: result.title || "",
        shortDescription: result.shortDescription || "",
        description: result.description || "",
        date: result.date ? result.date.split("T")[0] : "",
        categoryId: result.categoryId || "",
      });
    } else {
      resetForm();
    }
  }, [result, isEdit]);

  const validateField = (field, value) => {
    switch (field) {
      case "title":
        if (!value.trim()) return "Il titolo è obbligatorio.";
        break;
      case "shortDescription":
        if (!value.trim()) return "La descrizione breve è obbligatoria.";
        break;
      case "description":
        if (!value.trim()) return "La descrizione è obbligatoria.";
        break;
      case "date":
        if (!value) return "La data è obbligatoria.";
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
        date: form.date,
        categoryId: form.categoryId,
      };

      let savedResult;
      if (isEdit) {
        savedResult = await updateResult(result.resultId, payload, file, token);
      } else {
        savedResult = await createResult(payload, file, token);
        resetForm();
      }

      onResultSaved(savedResult);
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
        <Modal.Title>{isEdit ? "Modifica Risultato" : "Aggiungi Risultato"}</Modal.Title>
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
            <Form.Label>Descrizione breve *</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.shortDescription}
              onChange={e => handleChange("shortDescription", e.target.value)}
              isInvalid={!!errors.shortDescription}
            />
            <Form.Control.Feedback type="invalid">{errors.shortDescription}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Descrizione *</Form.Label>
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
            <Form.Label>Data *</Form.Label>
            <Form.Control type="date" value={form.date} onChange={e => handleChange("date", e.target.value)} isInvalid={!!errors.date} />
            <Form.Control.Feedback type="invalid">{errors.date}</Form.Control.Feedback>
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

            {isEdit && result.images?.length > 0 && !file && (
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

export default ResultModal;
