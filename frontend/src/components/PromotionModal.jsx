import { useEffect, useMemo, useState } from "react";
import { Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { createPromotion, updatePromotion } from "../api/modules/promotions.api";

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
  const { token } = useSelector(s => s.auth);
  const isEdit = Boolean(promotion);

  const [form, setForm] = useState(initialForm);
  const [bannerImage, setBannerImage] = useState(null);
  const [cardImage, setCardImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

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
    setBannerImage(null);
    setCardImage(null);
    setErrors({});
  }, [isEdit, promotion, show]);

  // Gestione cambi valori
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleMultiSelect = (field, options) => {
    const values = Array.from(options)
      .filter(o => o.selected)
      .map(o => o.value);
    setForm(prev => ({ ...prev, [field]: values }));
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

  // ✅ Submit
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const files = { bannerImage, cardImage };
      const saved = isEdit ? await updatePromotion(promotion.promotionId, payload, files, token) : await createPromotion(payload, files, token);
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
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? "Modifica Promozione" : "Nuova Promozione"}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
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
                <Form.Label>Ambito</Form.Label>
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

            {(form.scope === "PRODUCTS" || form.scope === "MIXED") && (
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Prodotti inclusi</Form.Label>
                  <Form.Select multiple value={form.productIds} onChange={e => handleMultiSelect("productIds", e.target.options)}>
                    {products.map(p => (
                      <option key={p.productId} value={p.productId}>
                        {p.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            )}

            {(form.scope === "SERVICES" || form.scope === "MIXED") && (
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Servizi inclusi</Form.Label>
                  <Form.Select multiple value={form.serviceIds} onChange={e => handleMultiSelect("serviceIds", e.target.options)}>
                    {services.map(s => (
                      <option key={s.serviceId} value={s.serviceId}>
                        {s.title}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            )}

            <Col md={6}>
              <Form.Group>
                <Form.Label>Banner immagine (grande)</Form.Label>
                <Form.Control type="file" accept="image/*" onChange={e => setBannerImage(e.target.files[0])} />
                {isEdit && promotion.bannerImageUrl && !bannerImage && <small className="text-muted d-block mt-1">Immagine attuale mantenuta</small>}
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Card immagine (mostrata nella lista promozioni)</Form.Label>
                <Form.Control type="file" accept="image/*" onChange={e => setCardImage(e.target.files[0])} />
                {isEdit && promotion.cardImageUrl && !cardImage && <small className="text-muted d-block mt-1">Immagine attuale mantenuta</small>}
              </Form.Group>
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
