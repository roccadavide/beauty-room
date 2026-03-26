import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Row, Spinner } from "react-bootstrap";
import { getAvailSlotsForServiceDay } from "../../api/modules/adminAgenda.api";
import { getCustomerSummary } from "../../api/modules/customer.api";
import UnifiedDrawer from "../common/UnifiedDrawer";
import CustomerAutocomplete from "./CustomerAutocomplete";

// ── helpers ───────────────────────────────────────────────────────────────────
const pad2 = n => String(n).padStart(2, "0");

const normalizeDateTimeLocal = v => {
  if (!v) return "";
  if (v.length === 16) return `${v}:00`;
  return v;
};

const WALKIN_MARKER = "@beautyroom.local";
const isWalkInEmail = email => !email || email.includes(WALKIN_MARKER);

const PILL_META = {
  PENDING: { label: "In attesa", tone: "pending" },
  PENDING_PAYMENT: { label: "Attesa pagamento", tone: "pending" },
  CONFIRMED: { label: "Confermato", tone: "confirmed" },
  COMPLETED: { label: "Completato", tone: "completed" },
  CANCELLED: { label: "Cancellato", tone: "cancelled" },
};
function MiniPill({ status }) {
  const m = PILL_META[status] || { label: status, tone: "neutral" };
  return (
    <span className={`ag-pill ag-pill--${m.tone}`} style={{ fontSize: ".68rem", padding: "1px 6px", lineHeight: 1.5 }}>
      {m.label}
    </span>
  );
}

// ── default form shape ────────────────────────────────────────────────────────
const EMPTY_FORM = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  startTime: "",
  notes: "",
  serviceId: "",
  serviceOptionId: null,
  customerId: null,
  paddingMinutes: 0, // FEATURE: minuti extra buffer post-trattamento (solo admin)
};

const PADDING_PRESETS = [0, 15, 20, 30, 45, 60];

// ═════════════════════════════════════════════════════════════════════════════
export default function BookingModal({ show, onHide, mode = "create", initial, services, onSubmit }) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [walkIn, setWalkIn] = useState(true);

  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  const [availLoading, setAvailLoading] = useState(false);
  const [availErr, setAvailErr] = useState("");
  const [slots, setSlots] = useState([]);

  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceCatFilter, setServiceCatFilter] = useState("all");

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!show) return;
    setSubmitted(false);
    setErrors({});
    setAvailErr("");
    setSlots([]);
    setCustomerDetail(null);
    setDetailErr("");

    if (initial) {
      setForm({
        customerName: initial.customerName ?? "",
        customerEmail: initial.customerEmail ?? "",
        customerPhone: initial.customerPhone ?? "",
        startTime: initial.startTime ? initial.startTime.slice(0, 16) : "",
        notes: initial.notes ?? "",
        serviceId: initial.serviceId ?? "",
        serviceOptionId: initial.serviceOptionId ?? initial.optionId ?? null,
        customerId: null,
        paddingMinutes: initial.paddingMinutes ?? 0, // FEATURE: ripopola il buffer in edit
      });
      setWalkIn(!isEdit);
    } else {
      setForm({ ...EMPTY_FORM });
      setWalkIn(true);
    }
    setServiceSearch("");
    setServiceCatFilter("all");
  }, [show, initial, isEdit]);

  // ── Fetch customer detail ────────────────────────────────────────────────
  useEffect(() => {
    if (!form.customerId) {
      setCustomerDetail(null);
      setDetailErr("");
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailErr("");

    getCustomerSummary(form.customerId)
      .then(d => {
        if (!cancelled) setCustomerDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetailErr("Impossibile caricare lo storico del cliente.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.customerId]);

  // ── Derived state ────────────────────────────────────────────────────────
  const selectedService = useMemo(() => services?.find(s => String(s.serviceId) === String(form.serviceId)), [services, form.serviceId]);

  const serviceCategories = useMemo(() => {
    const seen = new Set();
    const cats = [];
    (services || []).forEach(s => {
      const cat = s.category ?? s.categoryName ?? s.categoryLabel ?? null;
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        cats.push(cat);
      }
    });
    return cats;
  }, [services]);

  const filteredServices = useMemo(() => {
    let list = services || [];
    if (serviceCatFilter !== "all") {
      list = list.filter(s => (s.category ?? s.categoryName ?? s.categoryLabel) === serviceCatFilter);
    }
    const needle = serviceSearch.trim().toLowerCase();
    if (needle) {
      list = list.filter(s => s.title?.toLowerCase().includes(needle) || s.durationMin?.toString().includes(needle));
    }
    return list;
  }, [services, serviceSearch, serviceCatFilter]);

  const serviceOptions = useMemo(() => {
    const raw = selectedService?.options ?? selectedService?.serviceOptions ?? selectedService?.serviceOptionList;
    if (!Array.isArray(raw)) return [];
    return raw.filter(o => o?.active !== false);
  }, [selectedService]);

  const ensureWalkInEmail = useCallback(() => {
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    return `walkin+${stamp}@beautyroom.local`;
  }, []);

  const validate = useCallback(() => {
    const e = {};
    if (!form.customerName?.trim()) e.customerName = "Nome obbligatorio";
    if (!form.customerPhone?.trim()) e.customerPhone = "Telefono obbligatorio";
    if (!form.startTime) e.startTime = "Data/ora obbligatoria";
    if (!form.serviceId) e.serviceId = "Seleziona un servizio";
    if (!walkIn && !form.customerEmail?.trim()) e.customerEmail = "Email obbligatoria";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form, walkIn]);

  const fetchAvailSlots = useCallback(async () => {
    setAvailErr("");
    setSlots([]);
    if (!form.serviceId || !form.startTime) return;
    const dateISO = form.startTime.slice(0, 10);
    try {
      setAvailLoading(true);
      const s = await getAvailSlotsForServiceDay(form.serviceId, dateISO);
      setSlots(s?.slots ?? []);
    } catch (e) {
      setAvailErr(e.message);
    } finally {
      setAvailLoading(false);
    }
  }, [form.serviceId, form.startTime]);

  const handleCustomerNameChange = useCallback(
    text => {
      setForm(f => ({ ...f, customerName: text, customerId: null }));
      if (submitted) setTimeout(() => validate(), 0);
    },
    [submitted, validate],
  );

  const handleCustomerSelect = useCallback(
    customer => {
      setForm(f => ({
        ...f,
        customerName: customer.fullName,
        customerPhone: customer.phone ?? f.customerPhone,
        customerEmail: customer.email && !isWalkInEmail(customer.email) && !walkIn ? customer.email : f.customerEmail,
        customerId: customer.customerId,
      }));
      if (customer.email && !isWalkInEmail(customer.email)) setWalkIn(false);
    },
    [walkIn],
  );

  // ── Submit ───────────────────────────────────────────────────────────────
  const submit = () => {
    setSubmitted(true);
    if (!validate()) return;

    const payload = {
      customerName: form.customerName,
      customerEmail: form.customerEmail,
      customerPhone: form.customerPhone,
      startTime: normalizeDateTimeLocal(form.startTime),
      notes: form.notes,
      serviceId: String(form.serviceId),
      serviceOptionId: form.serviceOptionId ? String(form.serviceOptionId) : null,
      // FEATURE paddingMinutes: inviato solo se > 0, altrimenti null
      paddingMinutes: form.paddingMinutes > 0 ? form.paddingMinutes : null,
    };

    if (walkIn && !payload.customerEmail?.trim()) {
      payload.customerEmail = ensureWalkInEmail();
    }

    onSubmit?.(payload);
  };

  const onChange = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (!submitted) return;
    setTimeout(() => validate(), 0);
  };

  // ── Padding preset handler ───────────────────────────────────────────────
  const setPadding = v => setForm(f => ({ ...f, paddingMinutes: v }));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <UnifiedDrawer
      show={show}
      onHide={onHide}
      title={isEdit ? "Modifica appuntamento" : "Nuovo appuntamento"}
      size="md"
      footer={
        <div className="ud-footer-actions">
          <Button className="ag-btn ag-btn--ghost" onClick={onHide} type="button">
            Annulla
          </Button>
          <Button className="ag-btn ag-btn--primary" onClick={submit} type="button">
            {isEdit ? "Salva modifiche" : "Crea appuntamento"}
          </Button>
        </div>
      }
    >
      <Row className="g-3">
        {/* ── Dettagli cliente ─────────────────────────────────── */}
        <Col md={12}>
          <div className="ag-section">
            <div className="ag-section__title">Dettagli cliente</div>
            <Form noValidate>
              <Row className="g-2">
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Nome *</Form.Label>
                    <CustomerAutocomplete
                      value={form.customerName}
                      onChange={handleCustomerNameChange}
                      onSelect={handleCustomerSelect}
                      isInvalid={submitted && !!errors.customerName}
                      placeholder="Cerca o inserisci nome…"
                    />
                    {submitted && errors.customerName && <div className="invalid-feedback d-block">{errors.customerName}</div>}
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Telefono *</Form.Label>
                    <Form.Control
                      value={form.customerPhone}
                      onChange={e => onChange("customerPhone", e.target.value)}
                      isInvalid={submitted && !!errors.customerPhone}
                      placeholder="Es. 333…"
                    />
                    <Form.Control.Feedback type="invalid">{errors.customerPhone}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-2">
                <div className="d-flex align-items-center justify-content-between">
                  <Form.Label className="mb-0">Email {walkIn ? "" : "*"}</Form.Label>
                  <Form.Check
                    type="switch"
                    id="walkin-switch"
                    label="Walk-in (senza email)"
                    checked={walkIn}
                    onChange={e => {
                      setWalkIn(e.target.checked);
                      if (!e.target.checked) {
                        onChange("customerEmail", form.customerEmail || "");
                      } else {
                        setErrors(prev => {
                          const copy = { ...prev };
                          delete copy.customerEmail;
                          return copy;
                        });
                      }
                    }}
                  />
                </div>
                <Form.Control
                  disabled={walkIn}
                  value={walkIn ? "" : form.customerEmail}
                  onChange={e => onChange("customerEmail", e.target.value)}
                  isInvalid={submitted && !!errors.customerEmail}
                  placeholder={walkIn ? "Generata automaticamente" : "cliente@email.com"}
                />
                <Form.Control.Feedback type="invalid">{errors.customerEmail}</Form.Control.Feedback>
                {walkIn && <div className="ag-help">Per i walk-in generiamo una email tecnica (il backend spesso la richiede).</div>}
              </Form.Group>

              <Form.Group>
                <Form.Label>Note</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={form.notes}
                  onChange={e => onChange("notes", e.target.value)}
                  placeholder="Preferenze, dettagli, pagato in contanti, ecc."
                />
              </Form.Group>
            </Form>

            {/* ── Customer summary panel ── */}
            {form.customerId && (
              <div className="ag-customer-panel mt-3">
                {detailLoading && (
                  <div className="d-flex align-items-center gap-2 ag-muted">
                    <Spinner size="sm" animation="border" />
                    <span style={{ fontSize: ".83rem" }}>Carico storico…</span>
                  </div>
                )}

                {detailErr && !detailLoading && (
                  <div className="ag-help" style={{ color: "rgba(251,191,36,.8)" }}>
                    {detailErr}
                  </div>
                )}

                {customerDetail && !detailLoading && (
                  <>
                    {customerDetail.activePackages?.length > 0 && (
                      <div className="mb-2">
                        <div className="ag-customer-panel__label">Pacchetti attivi</div>
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {customerDetail.activePackages.map(p => (
                            <span
                              key={p.packageCreditId}
                              className={`ag-pkg-badge ${
                                p.sessionsRemaining > 1 ? "ag-pkg-badge--green" : p.sessionsRemaining === 1 ? "ag-pkg-badge--yellow" : "ag-pkg-badge--grey"
                              }`}
                            >
                              {p.serviceOptionName} · {p.sessionsRemaining}/{p.sessionsTotal}
                              {p.expiryDate && (
                                <span className="ag-pkg-badge__exp">
                                  {" "}
                                  scade {new Date(p.expiryDate).toLocaleDateString("it-IT", { month: "short", year: "numeric" })}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {customerDetail.recentBookings?.length > 0 && (
                      <div>
                        <div className="ag-customer-panel__label">Ultimi appuntamenti</div>
                        <div className="ag-customer-panel__list mt-1">
                          {customerDetail.recentBookings.slice(0, 3).map(b => (
                            <div key={b.bookingId} className="ag-customer-panel__item">
                              <span className="ag-muted" style={{ fontSize: ".78rem", minWidth: 40 }}>
                                {new Date(b.startTime).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                              </span>
                              <span className="ag-dotsep">·</span>
                              <span style={{ fontSize: ".82rem" }}>{b.serviceTitle}</span>
                              {b.optionName && (
                                <>
                                  <span className="ag-dotsep">·</span>
                                  <span className="ag-muted" style={{ fontSize: ".78rem" }}>
                                    {b.optionName}
                                  </span>
                                </>
                              )}
                              <MiniPill status={b.bookingStatus} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!customerDetail.activePackages?.length && !customerDetail.recentBookings?.length && (
                      <div className="ag-help">Nessuno storico trovato per questo cliente.</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </Col>

        {/* ── Orario & servizio ─────────────────────────────────── */}
        <Col md={12}>
          <div className="ag-section">
            <div className="ag-section__title">Orario & servizio</div>
            <Form noValidate>
              <Form.Group className="mb-2">
                <Form.Label>Servizio *</Form.Label>

                <div className="ag-service-search-wrap mb-2">
                  <input
                    type="text"
                    className="ag-service-search"
                    placeholder="Cerca servizio…"
                    value={serviceSearch}
                    onChange={e => {
                      setServiceSearch(e.target.value);
                      onChange("serviceId", "");
                    }}
                    autoComplete="off"
                  />
                </div>

                {serviceCategories.length > 0 && (
                  <div className="ag-service-cats mb-2">
                    <button
                      type="button"
                      className={`ag-service-cat ${serviceCatFilter === "all" ? "is-active" : ""}`}
                      onClick={() => setServiceCatFilter("all")}
                    >
                      Tutti
                    </button>
                    {serviceCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        className={`ag-service-cat ${serviceCatFilter === cat ? "is-active" : ""}`}
                        onClick={() => setServiceCatFilter(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                <div className="ag-service-list">
                  {filteredServices.length === 0 && <div className="ag-service-empty">Nessun servizio trovato.</div>}
                  {filteredServices.map(s => (
                    <button
                      key={s.serviceId}
                      type="button"
                      className={`ag-service-item ${String(form.serviceId) === String(s.serviceId) ? "is-selected" : ""}`}
                      onClick={() => {
                        onChange("serviceId", s.serviceId);
                        setServiceSearch("");
                      }}
                    >
                      <span className="ag-service-item__title">{s.title}</span>
                      <span className="ag-service-item__meta">
                        {s.durationMin ? `${s.durationMin} min` : ""}
                        {s.price != null ? ` · €${Number(s.price).toFixed(0)}` : ""}
                      </span>
                    </button>
                  ))}
                </div>

                {submitted && errors.serviceId && <div className="invalid-feedback d-block">{errors.serviceId}</div>}
              </Form.Group>

              {serviceOptions.length > 0 && (
                <Form.Group className="mb-2">
                  <Form.Label>Opzione</Form.Label>
                  <Form.Select value={form.serviceOptionId ?? ""} onChange={e => onChange("serviceOptionId", e.target.value || null)}>
                    <option value="">Nessuna</option>
                    {serviceOptions.map(o => (
                      <option key={o.optionId ?? o.id} value={o.optionId ?? o.id}>
                        {o.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              )}

              <Form.Group className="mb-2">
                <Form.Label>Inizio *</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={form.startTime}
                  onChange={e => onChange("startTime", e.target.value)}
                  isInvalid={submitted && !!errors.startTime}
                />
                <Form.Control.Feedback type="invalid">{errors.startTime}</Form.Control.Feedback>
                <div className="ag-help">La fine la calcola il backend in base alla durata del servizio.</div>
              </Form.Group>

              {/* ── FEATURE: paddingMinutes ─────────────────────────── */}
              <Form.Group className="mb-2">
                <Form.Label className="small" style={{ color: "var(--ag-muted)" }}>
                  Buffer post-trattamento
                  <span style={{ marginLeft: 5, opacity: 0.55, fontSize: "0.78rem" }}>(tempo extra che blocca lo slot successivo)</span>
                </Form.Label>
                <div className="d-flex align-items-center flex-wrap gap-1">
                  {PADDING_PRESETS.map(m => (
                    <button key={m} type="button" className={`ag-nextslot__chip ${form.paddingMinutes === m ? "is-active" : ""}`} onClick={() => setPadding(m)}>
                      {m === 0 ? "Nessuno" : `+${m}′`}
                    </button>
                  ))}
                  <input
                    type="number"
                    className="ag-nextslot__custom"
                    min={0}
                    max={120}
                    step={5}
                    value={!PADDING_PRESETS.includes(form.paddingMinutes) ? form.paddingMinutes : ""}
                    placeholder="…′"
                    onChange={e => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && v >= 0 && v <= 120) setPadding(v);
                    }}
                  />
                </div>
                {form.paddingMinutes > 0 && (
                  <div className="ag-help mt-1">
                    ⏱ Lo slot successivo sarà bloccato per altri <strong>{form.paddingMinutes} min</strong> dopo la fine del trattamento.
                  </div>
                )}
              </Form.Group>
              {/* ─────────────────────────────────────────────────────── */}

              <div className="d-flex gap-2 flex-wrap mt-1">
                <Button className="ag-btn ag-btn--soft" size="sm" disabled={!form.serviceId || !form.startTime} onClick={fetchAvailSlots} type="button">
                  Suggerisci slot liberi
                </Button>
                {selectedService?.durationMin && (
                  <span className="ag-mini">
                    Durata: <b>{selectedService.durationMin} min</b>
                    {form.paddingMinutes > 0 && <span style={{ marginLeft: 4, opacity: 0.65 }}>+{form.paddingMinutes}′ buffer</span>}
                  </span>
                )}
              </div>

              {availLoading && (
                <div className="d-flex align-items-center gap-2 text-muted mt-2">
                  <Spinner size="sm" /> Carico slot…
                </div>
              )}
              {availErr && (
                <Alert variant="danger" className="mt-2 mb-0">
                  {availErr}
                </Alert>
              )}
              {!!slots.length && (
                <div className="ag-slots mt-2">
                  <div className="ag-help mb-1">Click su uno slot per impostare l'orario:</div>
                  <div className="ag-slots__grid">
                    {slots.slice(0, 30).map((s, i) => (
                      <button
                        key={`${s.start}-${i}`}
                        className={`ag-slot ${s.available === false ? "ag-slot--occupied" : ""}`}
                        type="button"
                        disabled={s.available === false}
                        onClick={() => {
                          const dateISO = form.startTime.slice(0, 10);
                          onChange("startTime", `${dateISO}T${s.start}`);
                        }}
                      >
                        {s.available === false ? "🔒 " : ""}
                        {s.start} – {s.end}
                      </button>
                    ))}
                  </div>
                  {slots.length > 30 && <div className="ag-help mt-1">Mostro i primi 30 per comodità.</div>}
                </div>
              )}
            </Form>
          </div>
        </Col>
      </Row>
    </UnifiedDrawer>
  );
}
