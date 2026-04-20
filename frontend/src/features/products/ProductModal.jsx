import { Form, Spinner } from "react-bootstrap";
import { createProduct, updateProduct, createProductOption, updateProductOption, deleteProductOption } from "../../api/modules/products.api";
import { useSelector } from "react-redux";
import { useEffect, useMemo, useState } from "react";
import CustomSelect from "../../components/common/CustomSelect";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";
import MultiImageUpload from "../../components/common/MultiImageUpload";
import { BadgesPicker } from "../../components/common/BadgeFlag";
import { buildMultipartForm } from "../../api/utils/multipart";

const EMPTY_DRAFT = { name: "", optionGroup: "", price: "", stock: "", imageUrl: "" };

const ProductModal = ({ show, onHide, categories, onProductSaved, product }) => {
  const { accessToken } = useSelector(state => state.auth);

  const isEdit = Boolean(product);

  const [form, setForm] = useState({
    name: "",
    price: "",
    shortDescription: "",
    description: "",
    stock: "",
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
  const [optionDraft, setOptionDraft] = useState(EMPTY_DRAFT);
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [optionDraftError, setOptionDraftError] = useState("");

  const categoryOptions = useMemo(() => categories.map(c => ({ value: c.categoryId, label: c.label })), [categories]);

  const resetForm = () => {
    setForm({ name: "", price: "", shortDescription: "", description: "", stock: "", categoryId: "" });
    setNewFiles([]);
    setRemovedUrls([]);
    setBadges([]);
    setErrors({});
    setHasOptions(false);
    setExistingOptions([]);
    setOptionsToDelete([]);
    setOptionsToAdd([]);
    setOptionsToUpdate([]);
    setOptionDraft(EMPTY_DRAFT);
    setEditingOptionId(null);
    setOptionDraftError("");
  };

  useEffect(() => {
    if (show) {
      if (isEdit) {
        setForm({
          name: product.name || "",
          price: product.price || "",
          shortDescription: product.shortDescription || "",
          description: product.description || "",
          stock: product.stock || "",
          categoryId: product.categoryId || "",
        });
        setBadges(product.badges ?? []);
      } else {
        resetForm();
      }
      if (isEdit && product.options && product.options.length > 0) {
        setHasOptions(true);
        setExistingOptions(product.options);
      } else {
        setHasOptions(false);
        setExistingOptions([]);
      }
      setOptionsToDelete([]);
      setOptionsToAdd([]);
      setOptionsToUpdate([]);
      setOptionDraft(EMPTY_DRAFT);
      setEditingOptionId(null);
      setOptionDraftError("");
      setNewFiles([]);
      setRemovedUrls([]);
      setErrors({});
    }
  }, [show, product, isEdit]);

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
        if (value === "" || value === null || value === undefined) return "Lo stock è obbligatorio.";
        if (isNaN(value) || parseInt(value) < 0) return "Lo stock deve essere un numero >= 0.";
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
    if (optionDraft.stock === "" || optionDraft.stock === null || optionDraft.stock === undefined) {
      setOptionDraftError("Lo stock è obbligatorio.");
      return;
    }
    const stockVal = parseInt(optionDraft.stock);
    if (isNaN(stockVal) || stockVal < 0) {
      setOptionDraftError("Lo stock deve essere >= 0.");
      return;
    }
    if (optionDraft.price !== "" && (isNaN(optionDraft.price) || parseFloat(optionDraft.price) <= 0)) {
      setOptionDraftError("Il prezzo deve essere > 0 se specificato.");
      return;
    }

    const priceVal = optionDraft.price !== "" ? parseFloat(optionDraft.price) : null;

    if (editingOptionId) {
      const isExisting = existingOptions.some(o => o.productOptionId === editingOptionId);
      if (isExisting) {
        setExistingOptions(prev =>
          prev.map(o =>
            o.productOptionId === editingOptionId
              ? { ...o, ...optionDraft, price: priceVal, stock: stockVal }
              : o
          )
        );
        setOptionsToUpdate(prev => {
          const filtered = prev.filter(o => o.productOptionId !== editingOptionId);
          return [...filtered, { productOptionId: editingOptionId, ...optionDraft, price: priceVal, stock: stockVal }];
        });
      } else {
        setOptionsToAdd(prev =>
          prev.map(o =>
            o._tempId === editingOptionId
              ? { ...o, ...optionDraft, price: priceVal, stock: stockVal }
              : o
          )
        );
      }
    } else {
      setOptionsToAdd(prev => [
        ...prev,
        { ...optionDraft, price: priceVal, stock: stockVal, _tempId: Date.now() + Math.random() },
      ]);
    }

    setOptionDraft(EMPTY_DRAFT);
    setEditingOptionId(null);
    setOptionDraftError("");
  };

  const startEditOption = (opt, isExisting) => {
    setEditingOptionId(isExisting ? opt.productOptionId : opt._tempId);
    setOptionDraft({
      name: opt.name ?? "",
      optionGroup: opt.optionGroup ?? "",
      price: opt.price != null ? String(opt.price) : "",
      stock: opt.stock != null ? String(opt.stock) : "",
      imageUrl: opt.imageUrl ?? "",
    });
    setOptionDraftError("");
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
        removedImageUrls: removedUrls,
        badges: badges.length > 0 ? badges : null,
      };

      const formData = buildMultipartForm(payload, newFiles);

      let savedProduct;
      if (isEdit) {
        savedProduct = await updateProduct(product.productId, formData, accessToken);
      } else {
        savedProduct = await createProduct(formData, accessToken);
      }

      const productId = savedProduct.productId;

      if (optionsToDelete.length > 0) {
        await Promise.all(optionsToDelete.map(id => deleteProductOption(id)));
      }

      if (optionsToUpdate.length > 0) {
        await Promise.all(
          optionsToUpdate.map(opt =>
            updateProductOption(opt.productOptionId, {
              name: opt.name,
              optionGroup: opt.optionGroup || null,
              price: opt.price,
              stock: opt.stock,
              imageUrl: opt.imageUrl || null,
              active: true,
            })
          )
        );
      }

      if (optionsToAdd.length > 0) {
        await Promise.all(
          optionsToAdd.map(opt =>
            createProductOption(productId, {
              name: opt.name,
              optionGroup: opt.optionGroup || null,
              price: opt.price,
              stock: opt.stock,
              imageUrl: opt.imageUrl || null,
              active: true,
            })
          )
        );
      }

      if (!isEdit) {
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

  const existingImages = isEdit ? (product.images ?? []).filter(u => !removedUrls.includes(u)) : [];

  // Tutte le immagini disponibili per la selezione thumbnail (solo URL esistenti)
  const selectableImages = existingImages;

  return (
    <UnifiedDrawer
      show={show}
      onHide={onHide}
      title={isEdit ? "Modifica Prodotto" : "Aggiungi Prodotto"}
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
          <Form.Label>Nome *</Form.Label>
          <Form.Control type="text" value={form.name} onChange={e => handleChange("name", e.target.value)} isInvalid={!!errors.name} />
          <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group>
          <Form.Label>Prezzo (€) *</Form.Label>
          <Form.Control type="text" value={form.price} onChange={e => handleChange("price", e.target.value)} isInvalid={!!errors.price} />
          <Form.Control.Feedback type="invalid">{errors.price}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group>
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

        <Form.Group>
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

        <Form.Group>
          <Form.Label>Stock *</Form.Label>
          <Form.Control type="number" value={form.stock} onChange={e => handleChange("stock", e.target.value)} isInvalid={!!errors.stock} />
          <Form.Control.Feedback type="invalid">{errors.stock}</Form.Control.Feedback>
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
            id="product-has-options"
            label="Prodotto con varianti / opzioni"
            checked={hasOptions}
            onChange={e => setHasOptions(e.target.checked)}
          />
        </Form.Group>

        {hasOptions && (
          <div className="smo-options-editor">
            <div className="smo-options-editor__title">Gestione varianti / opzioni</div>

            {isEdit && existingOptions.length > 0 && (
              <div className="smo-option-list">
                {existingOptions.map(opt => (
                  <div
                    key={opt.productOptionId}
                    className={`smo-option-row${editingOptionId === opt.productOptionId ? " smo-option-row--editing" : ""}`}
                  >
                    <div className="smo-option-row__info">
                      <span className="smo-option-row__name">{opt.name}</span>
                      {opt.optionGroup && <span className="smo-option-row__group">{opt.optionGroup}</span>}
                      {opt.price != null
                        ? <span className="smo-option-row__price">€{opt.price}</span>
                        : <span className="smo-option-row__price smo-option-row__price--inherit">prezzo prodotto</span>
                      }
                      <span className="smo-option-row__dur">stock: {opt.stock}</span>
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
                          setOptionsToDelete(prev => [...prev, opt.productOptionId]);
                          setExistingOptions(prev => prev.filter(o => o.productOptionId !== opt.productOptionId));
                          if (editingOptionId === opt.productOptionId) {
                            setEditingOptionId(null);
                            setOptionDraft(EMPTY_DRAFT);
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
                      {item.price != null
                        ? <span className="smo-option-row__price">€{item.price}</span>
                        : <span className="smo-option-row__price smo-option-row__price--inherit">prezzo prodotto</span>
                      }
                      <span className="smo-option-row__dur">stock: {item.stock}</span>
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
                            setOptionDraft(EMPTY_DRAFT);
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
                {editingOptionId ? "✏️ Modifica variante" : "+ Aggiungi variante"}
              </div>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <Form.Control
                    type="text"
                    placeholder="Nome variante *  (es. Rosa Canina)"
                    value={optionDraft.name}
                    onChange={e => { setOptionDraft(p => ({ ...p, name: e.target.value })); setOptionDraftError(""); }}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <Form.Control
                    type="text"
                    placeholder="Gruppo (es. Fragranza)"
                    value={optionDraft.optionGroup}
                    onChange={e => { setOptionDraft(p => ({ ...p, optionGroup: e.target.value })); setOptionDraftError(""); }}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <Form.Control
                    type="number"
                    placeholder="Prezzo € (opzionale)"
                    value={optionDraft.price}
                    onChange={e => { setOptionDraft(p => ({ ...p, price: e.target.value })); setOptionDraftError(""); }}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <Form.Control
                    type="number"
                    placeholder="Stock *"
                    min={0}
                    value={optionDraft.stock}
                    onChange={e => { setOptionDraft(p => ({ ...p, stock: e.target.value })); setOptionDraftError(""); }}
                  />
                </div>
              </div>

              {/* Thumbnail gallery per associare un'immagine esistente */}
              {selectableImages.length > 0 && (
                <div className="mt-2">
                  <div className="small mb-1" style={{ color: "var(--bm-text-secondary, #666)" }}>
                    Immagine associata (opzionale)
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {selectableImages.map(url => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => {
                          setOptionDraft(p => ({ ...p, imageUrl: p.imageUrl === url ? "" : url }));
                          setOptionDraftError("");
                        }}
                        style={{
                          padding: 0,
                          border: optionDraft.imageUrl === url ? "2px solid #b8976a" : "2px solid transparent",
                          borderRadius: 6,
                          background: "none",
                          cursor: "pointer",
                          outline: "none",
                        }}
                        title={url}
                      >
                        <img
                          src={url}
                          alt=""
                          style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, display: "block" }}
                        />
                      </button>
                    ))}
                    {newFiles.length > 0 && (
                      <div
                        className="small d-flex align-items-center"
                        style={{ color: "var(--bm-text-secondary, #888)", fontSize: "0.75rem" }}
                      >
                        Carica prima le immagini e poi associa
                      </div>
                    )}
                  </div>
                </div>
              )}

              {optionDraftError && <div className="text-danger small mt-1">{optionDraftError}</div>}
              <div className="d-flex gap-2 mt-2">
                <button type="button" className="bm-btn bm-btn--primary" onClick={commitOptionDraft}>
                  {editingOptionId ? "Aggiorna variante" : "Aggiungi variante"}
                </button>
                {editingOptionId && (
                  <button
                    type="button"
                    className="bm-btn bm-btn--ghost"
                    onClick={() => { setEditingOptionId(null); setOptionDraft(EMPTY_DRAFT); setOptionDraftError(""); }}
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
          label="Immagini prodotto"
          maxFiles={8}
        />
      </Form>
    </UnifiedDrawer>
  );
};

export default ProductModal;
