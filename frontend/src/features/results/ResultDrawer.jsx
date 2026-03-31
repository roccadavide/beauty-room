// Migrated to UnifiedDrawer — 2026-03-20 — see _unified-drawer.css
import { useEffect, useMemo, useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import { createResult, updateResult } from "../../api/modules/results.api";
import { fetchServices } from "../../api/modules/services.api";
import CustomSelect from "../../components/common/CustomSelect";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";
import MultiImageUpload from "../../components/common/MultiImageUpload";
import { buildMultipartForm } from "../../api/utils/multipart";

const ResultDrawer = ({ show, onHide, categories, result, onResultSaved }) => {
  const isEdit = Boolean(result);

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [linkedServiceId, setLinkedServiceId] = useState("");
  const [services, setServices] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [removedUrls, setRemovedUrls] = useState([]);
  const [errors, setErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const categoryOptions = useMemo(() => categories.map(c => ({ value: c.categoryId, label: c.label })), [categories]);
  const linkedServiceOptions = useMemo(
    () => [{ value: "", label: "— Nessuno —" }, ...services.map(s => ({ value: s.serviceId, label: s.title }))],
    [services],
  );

  // Load services list once on mount
  useEffect(() => {
    fetchServices()
      .then(data => setServices(Array.isArray(data) ? data : data.content ?? []))
      .catch(() => {});
  }, []);

  // Populate form on open
  useEffect(() => {
    if (show) {
      if (isEdit) {
        setTitle(result.title || "");
        setShortDescription(result.shortDescription || "");
        setDescription(result.description || "");
        setCategoryId(result.categoryId || "");
        setLinkedServiceId(result.linkedServiceId || "");
      } else {
        setTitle("");
        setShortDescription("");
        setDescription("");
        setCategoryId("");
        setLinkedServiceId("");
      }
      setNewFiles([]);
      setRemovedUrls([]);
      setErrors({});
      setErrorMsg("");
    }
  }, [show, isEdit, result]);

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
      const payload = {
        title,
        shortDescription,
        description,
        categoryId,
        linkedServiceId: linkedServiceId || null,
        removedImageUrls: removedUrls,
      };
      const formData = buildMultipartForm(payload, newFiles);

      const saved = isEdit ? await updateResult(result.resultId, formData) : await createResult(formData);

      onResultSaved(saved);
      handleClose();
    } catch (err) {
      setErrorMsg(err.message || "Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

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
          <CustomSelect
            label="Categoria *"
            options={categoryOptions}
            value={categoryId}
            onChange={v => {
              setCategoryId(v);
              setErrors(p => ({ ...p, categoryId: null }));
            }}
            placeholder="-- Seleziona una categoria --"
            error={errors.categoryId || null}
            isInvalid={!!errors.categoryId}
          />
        </Form.Group>

        <Form.Group className="rd-field">
          <CustomSelect
            label="Trattamento collegato (opzionale)"
            options={linkedServiceOptions}
            value={linkedServiceId}
            onChange={v => setLinkedServiceId(v)}
            placeholder="— Nessuno —"
            className="rd-select-service"
          />
          <Form.Text className="text-muted" style={{ fontSize: "0.75rem" }}>
            Se collegato, nella card pubblica apparirà un link al trattamento.
          </Form.Text>
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

        <MultiImageUpload
          files={newFiles}
          existingUrls={(isEdit ? result?.images ?? [] : []).filter(u => !removedUrls.includes(u))}
          onChange={setNewFiles}
          onRemoveExisting={url => setRemovedUrls(prev => [...prev, url])}
          label="Immagini (Prima → Dopo)"
          maxFiles={2}
        />
      </Form>
    </UnifiedDrawer>
  );
};

export default ResultDrawer;
