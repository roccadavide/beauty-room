import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { createProduct, updateProduct } from "../api/api";
import { useSelector } from "react-redux";
import { useEffect, useState } from "react";

const ProductModal = ({ show, onHide, categories, onProductSaved, product }) => {
  const { token } = useSelector(state => state.auth);

  const isEdit = Boolean(product);

  const [form, setForm] = useState({
    name: "",
    price: "",
    shortDescription: "",
    description: "",
    stock: "",
    categoryId: "",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setForm({
      name: "",
      price: "",
      shortDescription: "",
      description: "",
      stock: "",
      categoryId: "",
    });
    setFile(null);
    setErrors({});
  };

  useEffect(() => {
    if (isEdit) {
      setForm({
        name: product.name || "",
        price: product.price || "",
        shortDescription: product.shortDescription || "",
        description: product.description || "",
        stock: product.stock || "",
        categoryId: product.categoryId || "",
      });
    } else {
      resetForm();
    }
  }, [product, isEdit]);

  const validateField = (field, value) => {
    switch (field) {
      case "name":
        if (!value.trim()) return "Il nome è obbligatorio.";
        break;
      case "price":
        if (!value) return "Il prezzo è obbligatorio.";
        if (isNaN(value) || parseFloat(value) <= 0) return "Il prezzo deve essere un numero positivo.";
        break;
      case "shortDescription":
        if (!value.trim()) return "La descrizione breve è obbligatoria.";
        break;
      case "description":
        if (!value.trim()) return "La descrizione è obbligatoria.";
        break;
      case "stock":
        if (!value) return "Lo stock è obbligatorio.";
        if (isNaN(value) || parseInt(value) <= 0) return "Lo stock deve essere un numero positivo.";
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
        name: form.name,
        price: parseFloat(form.price),
        shortDescription: form.shortDescription,
        description: form.description,
        stock: parseInt(form.stock, 10),
        categoryId: form.categoryId,
      };

      let savedProduct;
      if (isEdit) {
        savedProduct = await updateProduct(product.productId, payload, file, token);
      } else {
        savedProduct = await createProduct(payload, file, token);
        resetForm();
      }

      onProductSaved(savedProduct);
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
        <Modal.Title>{isEdit ? "Modifica Prodotto" : "Aggiungi Prodotto"}</Modal.Title>
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
            <Form.Label>Prezzo (€) *</Form.Label>
            <Form.Control type="text" value={form.price} onChange={e => handleChange("price", e.target.value)} isInvalid={!!errors.price} />
            <Form.Control.Feedback type="invalid">{errors.price}</Form.Control.Feedback>
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
            <Form.Label>Stock *</Form.Label>
            <Form.Control type="number" value={form.stock} onChange={e => handleChange("stock", e.target.value)} isInvalid={!!errors.stock} />
            <Form.Control.Feedback type="invalid">{errors.stock}</Form.Control.Feedback>
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

            {isEdit && product.images?.length > 0 && !file && (
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

export default ProductModal;
