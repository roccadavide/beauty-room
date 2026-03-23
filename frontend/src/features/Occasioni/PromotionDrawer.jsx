// Migrated to UnifiedDrawer — 2026-03-20 — see _unified-drawer.css
import { useEffect, useMemo, useState } from "react";
import { Col, Form, Row, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { createPromotion, updatePromotion } from "../../api/modules/promotions.api";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";
import ServiceProductSelector from "./ServiceProductSelector";

const ImageUploadZone = ({ current, onFile, aspectHint }) => {
  const [preview, setPreview] = useState(current || null);
  const handleFile = f => {
    setPreview(URL.createObjectURL(f));
    onFile(f);
  };
  return (
    <div
      className="img-upload-zone"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => document.getElementById(`file-${aspectHint}`)?.click()}
    >
      {preview ? (
        <img src={preview} alt="preview" className="img-upload-preview" />
      ) : (
        <span className="img-upload-placeholder">Trascina qui o clicca · {aspectHint}</span>
      )}
      <input
        id={`file-${aspectHint}`}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          if (e.target.files[0]) handleFile(e.target.files[0]);
        }}
      />
    </div>
  );
};

const DISCOUNT_TYPES = [
  { v: "NONE", l: "Nessuno sconto" },
  { v: "PERCENTAGE", l: "Sconto percentuale (%)" },
  { v: "FIXED", l: "Sconto importo fisso (€)" },
  { v: "PRICE_OVERRIDE", l: "Prezzo finale personalizzato (€)" },
];

const SCOPES = [
  { v: "GLOBAL", l: "Tutto il sito" },
  { v: "PRODUCTS", l: "Solo Prodotti" },
  { v: "SERVICES", l: "Solo Trattamenti" },
  { v: "MIXED", l: "Prodotti e Trattamenti insieme" },
];

const initialForm = {
  title: "",
  subtitle: "",
  description: "",
  ctaLabel: "",
  ctaLink: "",
  startDate: "",
  endDate: "",
  active: true,
  onlineOnly: false,
  priority: 0,
  discountType: "NONE",
  discountValue: "",
  scope: "GLOBAL",
  productIds: [],
  serviceIds: [],
  categoryIds: [],
};

const PromotionDrawer = ({ show, onHide, onSaved, products, services, promotion }) => {
  const { accessToken } = useSelector(s => s.auth);
  const isEdit = Boolean(promotion);

  const [form, setForm] = useState(initialForm);
  const [bannerImage, setBannerImage] = useState(null);
  const [cardImage, setCardImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) {
      if (isEdit) {
        setForm({
          title: promotion.title ?? "",
          subtitle: promotion.subtitle ?? "",
          description: promotion.description ?? "",
          ctaLabel: promotion.ctaLabel ?? "",
          ctaLink: promotion.ctaLink ?? "",
          startDate: promotion.startDate ?? "",
          endDate: promotion.endDate ?? "",
          active: promotion.active ?? true,
          onlineOnly: promotion.onlineOnly ?? false,
          priority: promotion.priority ?? 0,
          discountType: promotion.discountType ?? "NONE",
          discountValue: promotion.discountValue ? String(promotion.discountValue) : "",
          scope: promotion.scope ?? "GLOBAL",
          productIds: promotion.productIds ?? [],
          serviceIds: promotion.serviceIds ?? [],
          categoryIds: promotion.categoryIds ?? [],
        });
      } else {
        setForm(initialForm);
      }
      setBannerImage(null);
      setCardImage(null);
      setErrors({});
      setErrorMsg("");
    }
  }, [show, isEdit, promotion]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validateField = (field, value) => {
    switch (field) {
      case "title":
        if (!String(value).trim()) return "Il titolo è obbligatorio.";
        break;
      case "priority":
        if (value === "" || isNaN(value)) return "Inserisci un numero.";
        break;
      case "discountValue":
        if (form.discountType !== "NONE") {
          const n = Number(String(value).replace(",", "."));
          if (isNaN(n) || n <= 0) return "Il valore deve essere maggiore di zero.";
          if (form.discountType === "PERCENTAGE" && n > 100) return "Max 100%.";
        }
        break;
      case "endDate":
        if (form.startDate && value && new Date(value) < new Date(form.startDate)) return "La data di fine deve essere dopo la data di inizio.";
        break;
      default:
        return null;
    }
    return null;
  };

  const validateForm = () => {
    const errs = {};
    Object.entries(form).forEach(([k, v]) => {
      const e = validateField(k, v);
      if (e) errs[k] = e;
    });
    if (form.scope === "PRODUCTS" && !form.productIds?.length) errs.scope = "Seleziona almeno un prodotto.";
    if (form.scope === "SERVICES" && !form.serviceIds?.length) errs.scope = "Seleziona almeno un servizio.";
    if (form.scope === "MIXED" && !form.productIds?.length && !form.serviceIds?.length) errs.scope = "Seleziona almeno un prodotto o un servizio.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const payload = useMemo(() => {
    const toNumber = v => (v == null ? null : Number(String(v).replace("%", "").replace(",", ".").trim()));
    const dv = form.discountType === "NONE" ? null : toNumber(form.discountValue);
    return {
      title: form.title,
      subtitle: form.subtitle || null,
      description: form.description || null,
      ctaLabel: form.ctaLabel || null,
      ctaLink: form.ctaLink || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      active: !!form.active,
      onlineOnly: !!form.onlineOnly,
      priority: Number(form.priority || 0),
      discountType: form.discountType,
      discountValue: dv,
      scope: form.scope,
      productIds: form.productIds,
      serviceIds: form.serviceIds,
      categoryIds: form.categoryIds,
    };
  }, [form]);

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const files = { bannerImage, cardImage };
      const saved = isEdit ? await updatePromotion(promotion.promotionId, payload, files, accessToken) : await createPromotion(payload, files, accessToken);
      onSaved(saved);
      onHide();
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err.message || "Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <UnifiedDrawer
      show={show}
      onHide={onHide}
      title={isEdit ? "Modifica Promozione" : "Nuova Promozione"}
      size="lg"
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
                "Crea"
              )}
            </button>
          </div>
        </>
      }
    >
      <Form>
        <Row className="g-3">
          <Col md={8}>
            <Form.Group>
              <Form.Label>Titolo *</Form.Label>
              <Form.Control value={form.title} onChange={e => handleChange("title", e.target.value)} isInvalid={!!errors.title} />
              <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>Ordine di visualizzazione</Form.Label>
              <Form.Control type="number" value={form.priority} onChange={e => handleChange("priority", e.target.value)} />
              <Form.Text className="text-muted">Numero più alto = mostrata prima</Form.Text>
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Group>
              <Form.Label>Sottotitolo</Form.Label>
              <Form.Control placeholder="Es. -20% su pacchetto corpo" value={form.subtitle} onChange={e => handleChange("subtitle", e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Group>
              <Form.Label>Descrizione</Form.Label>
              <Form.Control as="textarea" rows={3} value={form.description} onChange={e => handleChange("description", e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Data inizio</Form.Label>
              <Form.Control type="date" value={form.startDate || ""} onChange={e => handleChange("startDate", e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Data fine</Form.Label>
              <Form.Control type="date" value={form.endDate || ""} onChange={e => handleChange("endDate", e.target.value)} isInvalid={!!errors.endDate} />
              <Form.Control.Feedback type="invalid">{errors.endDate}</Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Tipo di sconto</Form.Label>
              <Form.Select value={form.discountType} onChange={e => handleChange("discountType", e.target.value)}>
                {DISCOUNT_TYPES.map(o => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Valore sconto</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                disabled={form.discountType === "NONE"}
                value={form.discountValue}
                onChange={e => handleChange("discountValue", e.target.value)}
                isInvalid={!!errors.discountValue}
              />
              <Form.Control.Feedback type="invalid">{errors.discountValue}</Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Check type="switch" id="pd-active" label="Promozione attiva" checked={form.active} onChange={e => handleChange("active", e.target.checked)} />
          </Col>
          <Col md={6}>
            <Form.Check
              type="switch"
              id="pd-online"
              label="Visibile solo online"
              checked={form.onlineOnly}
              onChange={e => handleChange("onlineOnly", e.target.checked)}
            />
          </Col>
          <Col md={12}>
            <Form.Group>
              <Form.Label>A chi si applica</Form.Label>
              <Form.Select value={form.scope} onChange={e => handleChange("scope", e.target.value)} isInvalid={!!errors.scope}>
                {SCOPES.map(s => (
                  <option key={s.v} value={s.v}>
                    {s.l}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{errors.scope}</Form.Control.Feedback>
            </Form.Group>
          </Col>
          {form.scope !== "GLOBAL" && (
            <Col md={12}>
              <ServiceProductSelector
                scope={form.scope}
                services={services}
                products={products}
                selectedServiceIds={form.serviceIds.map(String)}
                selectedProductIds={form.productIds.map(String)}
                onServicesChange={ids => handleChange("serviceIds", ids)}
                onProductsChange={ids => handleChange("productIds", ids)}
              />
            </Col>
          )}
          <Col md={12}>
            <p className="form-label mb-2">Immagine card (4:3 — anteprima lista)</p>
            <ImageUploadZone current={isEdit ? promotion.cardImageUrl : null} onFile={file => setCardImage(file)} aspectHint="4:3" />
          </Col>
          <Col md={12} className="mt-2">
            <p className="form-label mb-2">Immagine banner (16:9 — header drawer)</p>
            <ImageUploadZone current={isEdit ? promotion.bannerImageUrl : null} onFile={file => setBannerImage(file)} aspectHint="16:9" />
          </Col>
        </Row>
      </Form>
    </UnifiedDrawer>
  );
};

export default PromotionDrawer;
