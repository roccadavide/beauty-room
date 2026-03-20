// Migrated to UnifiedDrawer — 2026-03-20 — see _unified-drawer.css
import { useEffect, useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import { createResult, updateResult, buildResultFormData } from "../../api/modules/results.api";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";

const ResultDrawer = ({ show, onHide, categories, result, onResultSaved }) => {
  const isEdit = Boolean(result);

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [replaceImages, setReplaceImages] = useState(false);

  // Populate form on open
  useEffect(() => {
    if (show) {
      if (isEdit) {
        setTitle(result.title || "");
        setShortDescription(result.shortDescription || "");
        setDescription(result.description || "");
        setCategoryId(result.categoryId || "");
        setFiles([]);
        setReplaceImages(false);
      } else {
        setTitle("");
        setShortDescription("");
        setDescription("");
        setCategoryId("");
        setFiles([]);
        setReplaceImages(false);
      }
      setErrors({});
      setErrorMsg("");
    }
  }, [show, isEdit, result]);

  const handleFiles = e => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
  };

  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = "Il titolo è obbligatorio.";
    if (!shortDescription.trim()) errs.shortDescription = "La descrizione breve è obbligatoria.";
    if (!description.trim()) errs.description = "La descrizione è obbligatoria.";
    if (!categoryId) errs.categoryId = "La categoria è obbligatoria.";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const payload = { title, shortDescription, description, categoryId };
      // Se editing senza nuovi file e senza replaceImages, non appendere immagini
      const filesToSend = isEdit && !replaceImages ? [] : files;
      const formData = buildResultFormData(payload, filesToSend);

      const saved = isEdit ? await updateResult(result.resultId, formData) : await createResult(formData);

      onResultSaved(saved);
      handleClose();
    } catch (err) {
      setErrorMsg(err.message || "Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  const existingImages = result?.images || [];

  return (
    <UnifiedDrawer
      show={show}
      onHide={onHide}
      title={isEdit ? "Modifica Risultato" : "Nuovo Risultato"}
      size="sm"
      footer={
        <>
          {errorMsg && <p className="ud-error">{errorMsg}</p>}
          <div className="ud-footer-actions">
            <button type="button" className="bm-btn bm-btn--ghost" onClick={onHide} disabled={loading}>
              Annulla
            </button>
            <button type="button" className="bm-btn bm-btn--primary" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Spinner size="sm" animation="border" /> Salvataggio…
                </>
              ) : isEdit ? (
                "Salva modifiche"
              ) : (
                "Crea risultato"
              )}
            </button>
          </div>
        </>
      }
    >
      <Form className="rd-form">
        <Form.Group className="rd-field">
          <Form.Label>Titolo *</Form.Label>
          <Form.Control
            value={title}
            onChange={e => {
              setTitle(e.target.value);
              setErrors(p => ({ ...p, title: null }));
            }}
            isInvalid={!!errors.title}
            placeholder="Es. Laser viso - risultato finale"
          />
          <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="rd-field">
          <Form.Label>Categoria *</Form.Label>
          <Form.Select
            value={categoryId}
            onChange={e => {
              setCategoryId(e.target.value);
              setErrors(p => ({ ...p, categoryId: null }));
            }}
            isInvalid={!!errors.categoryId}
          >
            <option value="">-- Seleziona una categoria --</option>
            {categories.map(c => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.label}
              </option>
            ))}
          </Form.Select>
          <Form.Control.Feedback type="invalid">{errors.categoryId}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="rd-field">
          <div className="d-flex justify-content-between">
            <Form.Label>Descrizione breve *</Form.Label>
            <small className="text-muted">{shortDescription.length}/180</small>
          </div>
          <Form.Control
            as="textarea"
            rows={2}
            maxLength={180}
            value={shortDescription}
            onChange={e => {
              setShortDescription(e.target.value);
              setErrors(p => ({ ...p, shortDescription: null }));
            }}
            isInvalid={!!errors.shortDescription}
            placeholder="Breve descrizione del risultato…"
          />
          <Form.Control.Feedback type="invalid">{errors.shortDescription}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="rd-field">
          <Form.Label>Descrizione completa</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={description}
            onChange={e => {
              setDescription(e.target.value);
              setErrors(p => ({ ...p, description: null }));
            }}
            isInvalid={!!errors.description}
            placeholder="Descrizione dettagliata del trattamento e del risultato…"
          />
          <Form.Control.Feedback type="invalid">{errors.description}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="rd-field">
          <Form.Label>Immagini (Prima → Dopo)</Form.Label>
          <small className="d-block text-muted mb-2">La prima immagine sarà il "Prima", la seconda il "Dopo"</small>

          {isEdit && existingImages.length > 0 && (
            <div className="rd-existing-wrap">
              <div className="rd-preview-grid">
                {existingImages.slice(0, 2).map((url, i) => (
                  <div key={i} className="rd-preview-item">
                    <img src={url} alt={i === 0 ? "Prima" : "Dopo"} className="rd-preview-img" />
                    <span className="rd-preview-label">{i === 0 ? "Prima" : "Dopo"}</span>
                  </div>
                ))}
              </div>
              <Form.Check
                type="checkbox"
                id="rd-replace-check"
                label="Sostituisci immagini"
                checked={replaceImages}
                onChange={e => setReplaceImages(e.target.checked)}
                className="mt-2"
              />
            </div>
          )}

          {(!isEdit || replaceImages) && (
            <>
              <Form.Control type="file" multiple accept="image/*" onChange={handleFiles} />
              {files.length > 0 && (
                <div className="rd-preview-grid mt-2">
                  {files.slice(0, 2).map((f, i) => (
                    <div key={i} className="rd-preview-item">
                      <img src={URL.createObjectURL(f)} alt={i === 0 ? "Prima" : "Dopo"} className="rd-preview-img" />
                      <span className="rd-preview-label">{i === 0 ? "Prima" : "Dopo"}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Form.Group>
      </Form>
    </UnifiedDrawer>
  );
};

export default ResultDrawer;
