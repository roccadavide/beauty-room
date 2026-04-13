import { useState, useEffect, useMemo } from "react";
import { Form, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { createService, updateService, createServiceOption, updateServiceOption, deleteServiceOption } from "../../api/modules/services.api";
import CustomSelect from "../../components/common/CustomSelect";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";
import MultiImageUpload from "../../components/common/MultiImageUpload";
import { BadgesPicker } from "../../components/common/BadgeFlag";
import { buildMultipartForm } from "../../api/utils/multipart";

const ServiceModal = ({ show, onHide, categories, onServiceSaved, service }) => {
  const { accessToken } = useSelector(state => state.auth);

  const isEdit = Boolean(service);

  const [form, setForm] = useState({
    title: "",
    shortDescription: "",
    description: "",
    price: "",
    durationMin: "",
    categoryId: "",
  });
  const [newFiles, setNewFiles] = useState([]);
  const [removedUrls, setRemovedUrls] = useState([]);
  const [badges, setBadges] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasOptions, setHasOptions] = useState(false);
  const [existingOptions, setExistingOptions] = useState([]);
  const [optionsToDelete, setOptionsToDelete] = useState([]);
  const [optionsToAdd, setOptionsToAdd] = useState([]);
  const [optionsToUpdate, setOptionsToUpdate] = useState([]);

  const EMPTY_DRAFT = { name: "", optionGroup: "", price: "", durationMin: "", gender: "" };
  const [optionDraft, setOptionDraft] = useState(EMPTY_DRAFT);
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [optionDraftError, setOptionDraftError] = useState("");

  const categoryOptions = useMemo(() => categories.map(c => ({ value: c.categoryId, label: c.label })), [categories]);

  const resetForm = () => {
    setForm({
      title: "",
      shortDescription: "",
      description: "",
      price: "",
      durationMin: "",
      categoryId: "",
    });
    setNewFiles([]);
    setRemovedUrls([]);
    setBadges([]);
    setErrors({});
    setHasOptions(false);
    setExistingOptions([]);
    setOptionsToDelete([]);
    setOptionsToAdd([]);
    setOptionsToUpdate([]);
    setOptionDraft({ name: "", optionGroup: "", price: "", durationMin: "", gender: "" });
    setEditingOptionId(null);
    setOptionDraftError("");
  };

  useEffect(() => {
    if (show) {
      if (isEdit) {
        setForm({
          title: service.title || "",
          shortDescription: service.shortDescription || "",
          description: service.description || "",
          price: service.price || "",
          durationMin: service.durationMin || "",
          categoryId: service.categoryId || "",
        });
        setBadges(service.badges ?? []);
      } else {
        resetForm();
      }
      if (isEdit && service.options && service.options.length > 0) {
        setHasOptions(true);
        setExistingOptions(service.options);
      } else {
        setHasOptions(false);
        setExistingOptions([]);
      }
      setOptionsToDelete([]);
      setOptionsToAdd([]);
      setOptionsToUpdate([]);
      setOptionDraft({ name: "", optionGroup: "", price: "", durationMin: "", gender: "" });
      setEditingOptionId(null);
      setOptionDraftError("");
      setNewFiles([]);
      setRemovedUrls([]);
      setErrors({});
    }
  }, [show, service, isEdit]);

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

  const validateForm = () => {
    const newErrors = {};
    Object.keys(form).forEach(key => {
      const error = validateField(key, form[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const commitOptionDraft = () => {
    if (!optionDraft.name.trim()) {
      setOptionDraftError("Il nome è obbligatorio.");
      return;
    }
    if (!optionDraft.price || isNaN(optionDraft.price) || parseFloat(optionDraft.price) <= 0) {
      setOptionDraftError("Inserisci un prezzo valido.");
      return;
    }
    const durationMin = optionDraft.durationMin ? parseInt(optionDraft.durationMin) : null;
    if (optionDraft.durationMin && (isNaN(durationMin) || durationMin <= 0)) {
      setOptionDraftError("Durata non valida.");
      return;
    }

    if (editingOptionId) {
      const isExisting = existingOptions.some(o => o.optionId === editingOptionId);
      if (isExisting) {
        setExistingOptions(prev =>
          prev.map(o =>
            o.optionId === editingOptionId
              ? { ...o, ...optionDraft, price: parseFloat(optionDraft.price), durationMin }
              : o
          )
        );
        setOptionsToUpdate(prev => {
          const filtered = prev.filter(o => o.optionId !== editingOptionId);
          return [...filtered, { optionId: editingOptionId, ...optionDraft, price: parseFloat(optionDraft.price), durationMin }];
        });
      } else {
        setOptionsToAdd(prev =>
          prev.map(o =>
            o._tempId === editingOptionId
              ? { ...o, ...optionDraft, price: parseFloat(optionDraft.price), durationMin }
              : o
          )
        );
      }
    } else {
      setOptionsToAdd(prev => [
        ...prev,
        { ...optionDraft, price: parseFloat(optionDraft.price), durationMin, _tempId: Date.now() + Math.random() },
      ]);
    }

    setOptionDraft({ name: "", optionGroup: "", price: "", durationMin: "", gender: "" });
    setEditingOptionId(null);
    setOptionDraftError("");
  };

  const startEditOption = (opt, isExisting) => {
    setEditingOptionId(isExisting ? opt.optionId : opt._tempId);
    setOptionDraft({
      name: opt.name ?? "",
      optionGroup: opt.optionGroup ?? "",
      price: String(opt.price ?? ""),
      durationMin: opt.durationMin != null ? String(opt.durationMin) : "",
      gender: opt.gender ?? "",
    });
    setOptionDraftError("");
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
        removedImageUrls: removedUrls,
        badges: badges.length > 0 ? badges : null,
      };

      const formData = buildMultipartForm(payload, newFiles);

      let savedService;
      if (isEdit) {
        savedService = await updateService(service.serviceId, formData, accessToken);
      } else {
        savedService = await createService(formData, accessToken);
      }

      const serviceId = savedService.serviceId;

      if (optionsToDelete.length > 0) {
        await Promise.all(optionsToDelete.map(id => deleteServiceOption(id)));
      }

      if (optionsToUpdate.length > 0) {
        await Promise.all(
          optionsToUpdate.map(opt =>
            updateServiceOption(opt.optionId, {
              name: opt.name,
              optionGroup: opt.optionGroup || null,
              price: opt.price,
              sessions: 1,
              durationMin: opt.durationMin ?? null,
              gender: opt.gender || null,
              active: true,
              badges: [],
            })
          )
        );
      }

      if (optionsToAdd.length > 0) {
        await Promise.all(
          optionsToAdd.map(opt =>
            createServiceOption(serviceId, {
              name: opt.name,
              optionGroup: opt.optionGroup || null,
              price: opt.price,
              sessions: 1,
              durationMin: opt.durationMin ?? null,
              gender: opt.gender || null,
              active: true,
              badges: [],
            })
          ),
        );
      }

      if (!isEdit) {
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

  const existingImages = isEdit ? (service.images ?? []).filter(u => !removedUrls.includes(u)) : [];

  return (
    <UnifiedDrawer
      show={show}
      onHide={onHide}
      title={isEdit ? "Modifica Servizio" : "Aggiungi Servizio"}
      size="md"
      footer={
        <div className="ud-footer-actions">
          <button type="button" className="bm-btn bm-btn--ghost" onClick={onHide} disabled={loading}>
            Chiudi
          </button>
          <button type="button" className="bm-btn bm-btn--primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size="sm" animation="border" /> : isEdit ? "Salva modifiche" : "Crea"}
          </button>
        </div>
      }
    >
      {errors.general && <p className="ud-error">{errors.general}</p>}

      <Form className="d-flex flex-column gap-3">
        <Form.Group>
          <Form.Label>Titolo *</Form.Label>
          <Form.Control type="text" value={form.title} onChange={e => handleChange("title", e.target.value)} isInvalid={!!errors.title} />
          <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group>
          <Form.Label>Breve descrizione *</Form.Label>
          <Form.Control
            type="text"
            value={form.shortDescription}
            onChange={e => handleChange("shortDescription", e.target.value)}
            isInvalid={!!errors.shortDescription}
          />
          <Form.Control.Feedback type="invalid">{errors.shortDescription}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group>
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

        <Form.Group>
          <Form.Label>Prezzo (€) *</Form.Label>
          <Form.Control type="number" value={form.price} onChange={e => handleChange("price", e.target.value)} isInvalid={!!errors.price} />
          <Form.Control.Feedback type="invalid">{errors.price}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group>
          <Form.Label>Durata (min) *</Form.Label>
          <Form.Control type="number" value={form.durationMin} onChange={e => handleChange("durationMin", e.target.value)} isInvalid={!!errors.durationMin} />
          <Form.Control.Feedback type="invalid">{errors.durationMin}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group>
          <CustomSelect
            label="Categoria *"
            options={categoryOptions}
            value={form.categoryId}
            onChange={v => handleChange("categoryId", v)}
            placeholder="-- Seleziona una categoria --"
            error={errors.categoryId || null}
            isInvalid={!!errors.categoryId}
          />
        </Form.Group>

        <Form.Group>
          <BadgesPicker value={badges} onChange={setBadges} />
        </Form.Group>

        <Form.Group>
          <Form.Check
            type="switch"
            id="service-has-options"
            label="Servizio con opzioni (es. zone / varianti)"
            checked={hasOptions}
            onChange={e => setHasOptions(e.target.checked)}
          />
        </Form.Group>

        {hasOptions && (
          <div className="smo-options-editor">
            <div className="smo-options-editor__title">Gestione opzioni / zone</div>

            {isEdit && existingOptions.length > 0 && (
              <div className="smo-option-list">
                {existingOptions.map(opt => (
                  <div
                    key={opt.optionId}
                    className={`smo-option-row${editingOptionId === opt.optionId ? " smo-option-row--editing" : ""}`}
                  >
                    <div className="smo-option-row__info">
                      <span className="smo-option-row__name">{opt.name}</span>
                      {opt.optionGroup && <span className="smo-option-row__group">{opt.optionGroup}</span>}
                      <span className="smo-option-row__price">€{opt.price}</span>
                      {opt.durationMin && <span className="smo-option-row__dur">{opt.durationMin} min</span>}
                      {opt.gender && <span className="smo-option-row__gender">{opt.gender === "FEMALE" ? "♀" : "♂"}</span>}
                    </div>
                    <div className="smo-option-row__actions">
                      <button
                        type="button"
                        className="smo-option-row__btn smo-option-row__btn--edit"
                        onClick={() => startEditOption(opt, true)}
                        title="Modifica"
                      >✏️</button>
                      <button
                        type="button"
                        className="smo-option-row__btn smo-option-row__btn--del"
                        onClick={() => {
                          setOptionsToDelete(prev => [...prev, opt.optionId]);
                          setExistingOptions(prev => prev.filter(o => o.optionId !== opt.optionId));
                          if (editingOptionId === opt.optionId) {
                            setEditingOptionId(null);
                            setOptionDraft({ name: "", optionGroup: "", price: "", durationMin: "", gender: "" });
                          }
                        }}
                        title="Elimina"
                      >🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {optionsToAdd.length > 0 && (
              <div className="smo-option-list smo-option-list--new">
                {optionsToAdd.map(item => (
                  <div
                    key={item._tempId}
                    className={`smo-option-row smo-option-row--new${editingOptionId === item._tempId ? " smo-option-row--editing" : ""}`}
                  >
                    <div className="smo-option-row__info">
                      <span className="smo-option-row__badge-new">NUOVA</span>
                      <span className="smo-option-row__name">{item.name}</span>
                      {item.optionGroup && <span className="smo-option-row__group">{item.optionGroup}</span>}
                      <span className="smo-option-row__price">€{item.price}</span>
                      {item.durationMin && <span className="smo-option-row__dur">{item.durationMin} min</span>}
                      {item.gender && <span className="smo-option-row__gender">{item.gender === "FEMALE" ? "♀" : "♂"}</span>}
                    </div>
                    <div className="smo-option-row__actions">
                      <button
                        type="button"
                        className="smo-option-row__btn smo-option-row__btn--edit"
                        onClick={() => startEditOption(item, false)}
                      >✏️</button>
                      <button
                        type="button"
                        className="smo-option-row__btn smo-option-row__btn--del"
                        onClick={() => {
                          setOptionsToAdd(prev => prev.filter(o => o._tempId !== item._tempId));
                          if (editingOptionId === item._tempId) {
                            setEditingOptionId(null);
                            setOptionDraft({ name: "", optionGroup: "", price: "", durationMin: "", gender: "" });
                          }
                        }}
                      >🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="smo-option-form">
              <div className="smo-option-form__heading">
                {editingOptionId ? "✏️ Modifica opzione" : "+ Aggiungi opzione"}
              </div>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <Form.Control
                    type="text"
                    placeholder="Nome opzione *  (es. Baffetti)"
                    value={optionDraft.name}
                    onChange={e => { setOptionDraft(p => ({ ...p, name: e.target.value })); setOptionDraftError(""); }}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <Form.Control
                    type="text"
                    placeholder="Gruppo (es. Viso)"
                    value={optionDraft.optionGroup}
                    onChange={e => { setOptionDraft(p => ({ ...p, optionGroup: e.target.value })); setOptionDraftError(""); }}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <Form.Control
                    type="number"
                    placeholder="Prezzo €"
                    value={optionDraft.price}
                    onChange={e => { setOptionDraft(p => ({ ...p, price: e.target.value })); setOptionDraftError(""); }}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <Form.Control
                    type="number"
                    placeholder="Durata min"
                    value={optionDraft.durationMin}
                    onChange={e => { setOptionDraft(p => ({ ...p, durationMin: e.target.value })); setOptionDraftError(""); }}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <Form.Select
                    value={optionDraft.gender}
                    onChange={e => { setOptionDraft(p => ({ ...p, gender: e.target.value })); setOptionDraftError(""); }}
                  >
                    <option value="">Tutti i generi</option>
                    <option value="FEMALE">Donna</option>
                    <option value="MALE">Uomo</option>
                  </Form.Select>
                </div>
              </div>
              {optionDraftError && <div className="text-danger small mt-1">{optionDraftError}</div>}
              <div className="d-flex gap-2 mt-2">
                <button type="button" className="bm-btn bm-btn--primary" onClick={commitOptionDraft}>
                  {editingOptionId ? "Aggiorna opzione" : "Aggiungi opzione"}
                </button>
                {editingOptionId && (
                  <button
                    type="button"
                    className="bm-btn bm-btn--ghost"
                    onClick={() => { setEditingOptionId(null); setOptionDraft({ name: "", optionGroup: "", price: "", durationMin: "", gender: "" }); setOptionDraftError(""); }}
                  >
                    Annulla
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <MultiImageUpload
          files={newFiles}
          existingUrls={existingImages}
          onChange={setNewFiles}
          onRemoveExisting={url => setRemovedUrls(prev => [...prev, url])}
          label="Immagini servizio"
          maxFiles={8}
        />
      </Form>
    </UnifiedDrawer>
  );
};

export default ServiceModal;
