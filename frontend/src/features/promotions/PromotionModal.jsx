import { useEffect, useMemo, useState } from "react";
import { Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { createPromotion, updatePromotion } from "../../api/modules/promotions.api";
import CustomSelect from "../../components/common/CustomSelect";
import DateTimeField from "../../components/common/DateTimeField";
import MultiImageUpload from "../../components/common/MultiImageUpload";
import useLenisModalLock from "../../hooks/useLenisModalLock";

const DISCOUNT_TYPES = [
  { v: "NONE", l: "Nessuno (nessuno sconto)" },
  { v: "PERCENTAGE", l: "Percentuale (%)" },
  { v: "FIXED", l: "Importo fisso (€)" },
  { v: "PRICE_OVERRIDE", l: "Prezzo finale personalizzato (€ totale)" },
];

const SCOPES = [
  { v: "GLOBAL", l: "Globale (su tutto il sito o categorie intere)" },
  { v: "PRODUCTS", l: "Solo su Prodotti" },
  { v: "SERVICES", l: "Solo su Servizi" },
  { v: "MIXED", l: "Misto (Prodotti e/o Servizi insieme)" },
];

// Stato iniziale del form
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

const PromotionModal = ({ show, onHide, onSaved, products, services, promotion }) => {
  const { accessToken } = useSelector(s => s.auth);
  const isEdit = Boolean(promotion);

  const [form, setForm] = useState(initialForm);
  const [bannerFiles, setBannerFiles] = useState([]);
  const [cardFiles, setCardFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useLenisModalLock(show);

  useEffect(() => {
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
    setBannerFiles([]);
    setCardFiles([]);
    setErrors({});
  }, [isEdit, promotion, show]);

  // Gestione cambi valori
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const validateField = (field, value) => {
    switch (field) {
      case "title":
        if (!value.trim()) return "Il titolo è obbligatorio.";
        break;

      case "priority":
        if (value === "" || isNaN(value)) return "Inserisci un numero.";
        break;

      case "discountValue":
        if (form.discountType !== "NONE") {
          const n = Number(String(value).replace(",", "."));
          if (isNaN(n) || n <= 0) return "Il valore dello sconto deve essere maggiore di zero.";
          if (form.discountType === "PERCENTAGE" && n > 100) return "La percentuale non può superare 100.";
        }
        break;

      case "endDate":
        if (form.startDate && value && new Date(value) < new Date(form.startDate)) {
          return "La data di fine deve essere dopo la data di inizio.";
        }
        break;

      default:
        return null;
    }
    return null;
  };

  const validateScopeSelections = () => {
    if (form.scope === "PRODUCTS" && !form.productIds?.length) return "Seleziona almeno un prodotto.";
    if (form.scope === "SERVICES" && !form.serviceIds?.length) return "Seleziona almeno un servizio.";
    if (form.scope === "MIXED" && !form.productIds?.length && !form.serviceIds?.length) return "Seleziona almeno un prodotto o un servizio.";
    return null;
  };

  const validateForm = () => {
    const newErrors = {};
    Object.entries(form).forEach(([k, v]) => {
      const e = validateField(k, v);
      if (e) newErrors[k] = e;
    });
    const scopeErr = validateScopeSelections();
    if (scopeErr) newErrors.scope = scopeErr;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const payload = useMemo(() => {
    const toNumber = v => {
      if (v == null) return null;
      return Number(String(v).replace("%", "").replace(",", ".").trim());
    };

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

    try {
      setLoading(true);
      const files = { bannerImage: bannerFiles[0] ?? null, cardImage: cardFiles[0] ?? null };
      const saved = isEdit ? await updatePromotion(promotion.promotionId, payload, files, accessToken) : await createPromotion(payload, files, accessToken);
      onSaved(saved);
      onHide();
    } catch (err) {
      setErrors({
        general: err?.response?.data?.message || err.message || "Errore durante il salvataggio.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static" scrollable centered>
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? "Modifica Promozione" : "Nuova Promozione"}</Modal.Title>
      </Modal.Header>

      <Modal.Body
        data-lenis-prevent
        style={{
          maxHeight: "80vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {errors.general && <p className="text-danger fw-semibold">{errors.general}</p>}

        <Form>
          <Row className="g-3">
            <Col md={8}>
              <Form.Group>
                <Form.Label>Titolo *</Form.Label>
                <Form.Control value={form.title} onChange={e => handleChange("title", e.target.value)} isInvalid={!!errors.title} />
                <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
                <Form.Text className="text-muted">Nome della promozione che apparirà nella card.</Form.Text>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Priorità</Form.Label>
                <Form.Control type="number" value={form.priority} onChange={e => handleChange("priority", e.target.value)} />
                <Form.Text className="text-muted">Più alta → comparirà prima delle altre.</Form.Text>
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
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Dettagli dell'offerta..."
                  value={form.description}
                  onChange={e => handleChange("description", e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>CTA Label</Form.Label>
                <Form.Control placeholder="Testo bottone (es. Scopri ora)" value={form.ctaLabel} onChange={e => handleChange("ctaLabel", e.target.value)} />
                <Form.Text className="text-muted">Etichetta del pulsante, visibile sulla card (opzionale).</Form.Text>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>CTA Link</Form.Label>
                <Form.Control
                  placeholder="Link dove porta il bottone (es. /prodotti)"
                  value={form.ctaLink}
                  onChange={e => handleChange("ctaLink", e.target.value)}
                />
                <Form.Text className="text-muted">Lascia vuoto se non deve portare a nessuna pagina.</Form.Text>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <DateTimeField
                  label="Data inizio"
                  mode="date"
                  value={form.startDate || ""}
                  onChange={v => handleChange("startDate", v)}
                  placeholder="Seleziona data"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <DateTimeField
                  label="Data fine"
                  mode="date"
                  value={form.endDate || ""}
                  onChange={v => handleChange("endDate", v)}
                  error={errors.endDate || null}
                  placeholder="Seleziona data"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <CustomSelect
                  label="Tipo di sconto"
                  options={DISCOUNT_TYPES.map(o => ({ value: o.v, label: o.l }))}
                  value={form.discountType}
                  onChange={v => handleChange("discountType", v)}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Valore dello sconto</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  disabled={form.discountType === "NONE"}
                  value={form.discountValue}
                  onChange={e => handleChange("discountValue", e.target.value)}
                  isInvalid={!!errors.discountValue}
                />
                <Form.Control.Feedback type="invalid">{errors.discountValue}</Form.Control.Feedback>
                <Form.Text className="text-muted">
                  Esempio: <strong>20</strong> per 20% o <strong>10</strong> per 10€ di sconto.
                </Form.Text>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Check
                type="switch"
                id="promo-active"
                label="Promozione attiva"
                checked={form.active}
                onChange={e => handleChange("active", e.target.checked)}
              />
            </Col>

            <Col md={6}>
              <Form.Check
                type="switch"
                id="promo-online"
                label="Solo online"
                checked={form.onlineOnly}
                onChange={e => handleChange("onlineOnly", e.target.checked)}
              />
            </Col>

            <Col md={6}>
              <Form.Group>
                <CustomSelect
                  label="Ambito"
                  options={SCOPES.map(s => ({ value: s.v, label: s.l }))}
                  value={form.scope}
                  onChange={v => handleChange("scope", v)}
                  error={errors.scope || null}
                  isInvalid={!!errors.scope}
                />
              </Form.Group>
            </Col>

            {(form.scope === "PRODUCTS" || form.scope === "MIXED") && (
              <Col md={6}>
                <Form.Group>
                  <CustomSelect
                    multiple
                    label="Prodotti inclusi"
                    options={products.map(p => ({ value: p.productId, label: p.name }))}
                    value={form.productIds}
                    onChange={v => handleChange("productIds", v)}
                  />
                </Form.Group>
              </Col>
            )}

            {(form.scope === "SERVICES" || form.scope === "MIXED") && (
              <Col md={6}>
                <Form.Group>
                  <CustomSelect
                    multiple
                    label="Servizi inclusi"
                    options={services.map(s => ({ value: s.serviceId, label: s.title }))}
                    value={form.serviceIds}
                    onChange={v => handleChange("serviceIds", v)}
                  />
                </Form.Group>
              </Col>
            )}

            <Col md={6}>
              <MultiImageUpload
                files={bannerFiles}
                existingUrls={isEdit && promotion.bannerImageUrl && bannerFiles.length === 0 ? [promotion.bannerImageUrl] : []}
                onChange={setBannerFiles}
                onRemoveExisting={() => setBannerFiles([])}
                label="Banner immagine (16:9 — grande)"
                maxFiles={1}
              />
            </Col>

            <Col md={6}>
              <MultiImageUpload
                files={cardFiles}
                existingUrls={isEdit && promotion.cardImageUrl && cardFiles.length === 0 ? [promotion.cardImageUrl] : []}
                onChange={setCardFiles}
                onRemoveExisting={() => setCardFiles([])}
                label="Card immagine (4:3 — lista promozioni)"
                maxFiles={1}
              />
            </Col>
          </Row>
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

export default PromotionModal;
