import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Col, Form, Row, Spinner } from "react-bootstrap";
import { getAvailSlotsForServiceDay } from "../../api/modules/adminAgenda.api";
import CustomSelect from "./CustomSelect";

const pad2 = n => String(n).padStart(2, "0");

const normalizeDateTimeLocal = v => {
  if (!v) return "";
  if (v.length === 16) return `${v}:00`;
  return v;
};

export default function BookingModal({ show, onHide, mode = "create", initial, services, onSubmit }) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    startTime: "",
    notes: "",
    serviceId: "",
    serviceOptionId: null,
  });

  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const [walkIn, setWalkIn] = useState(true);

  const [availLoading, setAvailLoading] = useState(false);
  const [availErr, setAvailErr] = useState("");
  const [slots, setSlots] = useState([]);

  // Track whether we are on a "desktop-like" viewport to decide
  // between right-side drawer (>= 768px) and bottom sheet (< 768px)
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });

  // Root dialog panel ref, used for focus trapping and swipe handling
  const panelRef = useRef(null);

  // ── Gestione visibilità con animazione in/out ──────────────
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelActive, setPanelActive] = useState(false);

  useEffect(() => {
    if (show) {
      setPanelVisible(true);
      // doppio rAF: il browser fa un paint "a riposo" prima di aggiungere le classi
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setPanelActive(true)));
      return () => cancelAnimationFrame(id);
    } else {
      setPanelActive(false);
      // aspetta la durata della transizione (300ms) prima di smontare
      const t = setTimeout(() => setPanelVisible(false), 320);
      return () => clearTimeout(t);
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;

    setSubmitted(false);
    setErrors({});
    setAvailErr("");
    setSlots([]);

    if (initial) {
      setForm({
        customerName: initial.customerName ?? "",
        customerEmail: initial.customerEmail ?? "",
        customerPhone: initial.customerPhone ?? "",
        startTime: initial.startTime ? initial.startTime.slice(0, 16) : "",
        notes: initial.notes ?? "",
        serviceId: initial.serviceId ?? "",
        serviceOptionId: initial.serviceOptionId ?? initial.optionId ?? null,
      });
      setWalkIn(false);
    } else {
      setForm({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        startTime: "",
        notes: "",
        serviceId: "",
        serviceOptionId: null,
      });
      setWalkIn(true);
    }
  }, [show, initial]);

  // Keep layout responsive: update breakpoint flag while dialog is open
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");

    const handleChange = e => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const selectedService = useMemo(() => services?.find(s => String(s.serviceId) === String(form.serviceId)), [services, form.serviceId]);

  const serviceOptions = useMemo(() => {
    const raw = selectedService?.options || selectedService?.serviceOptions || selectedService?.serviceOptionList;
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

  // 1. Blocca overflow del body (dipende da show, come prima)
  useEffect(() => {
    if (!show) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [show]);

  // 2. Wheel trap — dipende da panelVisible così il DOM c'è già quando gira
  useEffect(() => {
    if (!panelVisible) return;
    const panel = panelRef.current;
    if (!panel) return;

    const trapWheel = e => {
      const body = panel.querySelector(".ag-dialog__body");
      if (!body) return;

      const { scrollTop, scrollHeight, clientHeight } = body;
      const atTop = scrollTop === 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      const scrollingUp = e.deltaY < 0;
      const scrollingDown = e.deltaY > 0;

      if ((scrollingUp && !atTop) || (scrollingDown && !atBottom)) {
        e.stopPropagation();
      } else {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    panel.addEventListener("wheel", trapWheel, { passive: false });
    return () => panel.removeEventListener("wheel", trapWheel);
  }, [panelVisible]);

  // Focus trap + ESC handling inside the dialog
  useEffect(() => {
    if (!show) return;
    const root = panelRef.current;
    if (!root) return;

    const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const focusables = Array.from(root.querySelectorAll(focusableSelector));
    if (focusables.length) {
      // Move focus inside the dialog when it opens
      focusables[0].focus();
    } else {
      root.focus();
    }

    const handleKeyDown = e => {
      if (e.key === "Escape") {
        e.preventDefault();
        onHide?.();
        return;
      }

      if (e.key !== "Tab") return;
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [show, onHide]);

  // Simple swipe-to-close for the bottom sheet (mobile only)
  useEffect(() => {
    if (!show || isDesktop) return;
    const root = panelRef.current;
    if (!root) return;

    let startY = null;
    let deltaY = 0;

    const onTouchStart = e => {
      if (!e.touches.length) return;
      startY = e.touches[0].clientY;
      deltaY = 0;
    };

    const onTouchMove = e => {
      if (startY == null || !e.touches.length) return;
      const currentY = e.touches[0].clientY;
      deltaY = currentY - startY;
    };

    const onTouchEnd = () => {
      if (startY != null && deltaY > 80) {
        onHide?.();
      }
      startY = null;
      deltaY = 0;
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: true });
    root.addEventListener("touchend", onTouchEnd);

    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
    };
  }, [show, isDesktop, onHide]);

  const submit = () => {
    setSubmitted(true);
    if (!validate()) return;

    const payload = {
      ...form,
      startTime: normalizeDateTimeLocal(form.startTime),
      serviceOptionId: form.serviceOptionId ? String(form.serviceOptionId) : null,
      serviceId: String(form.serviceId),
    };

    if (walkIn && !payload.customerEmail?.trim()) {
      payload.customerEmail = ensureWalkInEmail();
    }

    onSubmit?.(payload);
  };

  const onChange = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (!submitted) return;
    // re-validate live dopo il primo submit
    setTimeout(() => validate(), 0);
  };

  if (!panelVisible) return null;

  const dialogTitleId = "ag-booking-dialog-title";

  const panelClasses = [
    "ag-dialog-panel",
    isEdit ? "ag-dialog-panel--edit" : "ag-dialog-panel--create",
    isDesktop ? "ag-dialog-panel--side" : "ag-dialog-panel--sheet",
    panelActive ? "open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`ag-dialog-root${panelActive ? " ag-dialog-root--active" : ""}`} aria-hidden={false}>
      <div className="ag-dialog-backdrop" onClick={onHide} />

      <div
        ref={panelRef}
        className={panelClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {!isDesktop && <div className="ag-dialog-handle" aria-hidden="true" />}

        <header className="ag-modal__header ag-dialog__header">
          <h2 id={dialogTitleId} className="ag-modal__title">
            {isEdit ? "Modifica appuntamento" : "Nuovo appuntamento"}
          </h2>
          <button type="button" className="ag-dialog-close" onClick={onHide} aria-label="Chiudi">
            ×
          </button>
        </header>

        <div className="ag-modal__body ag-dialog__body">
          <Row className="g-3">
            <Col md={12}>
              <div className="ag-section">
                <div className="ag-section__title">Dettagli cliente</div>
                <Form noValidate>
                  <Row className="g-2">
                    <Col md={6}>
                      <Form.Group className="mb-2">
                        <Form.Label>Nome *</Form.Label>
                        <Form.Control
                          value={form.customerName}
                          onChange={e => onChange("customerName", e.target.value)}
                          isInvalid={submitted && !!errors.customerName}
                          placeholder="Es. Cliente…"
                        />
                        <Form.Control.Feedback type="invalid">{errors.customerName}</Form.Control.Feedback>
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
              </div>
            </Col>

            <Col md={12}>
              <div className="ag-section">
                <div className="ag-section__title">Orario & servizio</div>
                <Form noValidate>
                  {/* ← CustomSelect qui, Form.Select RIMOSSO */}
                  <Form.Group className="mb-2">
                    <Form.Label>Servizio *</Form.Label>
                    <CustomSelect
                      value={form.serviceId}
                      onChange={v => onChange("serviceId", v)}
                      isInvalid={submitted && !!errors.serviceId}
                      placeholder="Seleziona…"
                      options={(services || []).map(s => ({
                        value: s.serviceId,
                        label: [s.title, s.durationMin ? `${s.durationMin} min` : null, s.price != null ? `€${Number(s.price).toFixed(0)}` : null]
                          .filter(Boolean)
                          .join(" · "),
                      }))}
                    />
                    {submitted && errors.serviceId && <div className="invalid-feedback d-block">{errors.serviceId}</div>}
                  </Form.Group>

                  {serviceOptions.length > 0 ? (
                    <Form.Group className="mb-2">
                      <Form.Label>Opzione (facoltativa)</Form.Label>
                      <Form.Select value={form.serviceOptionId ?? ""} onChange={e => onChange("serviceOptionId", e.target.value || null)}>
                        <option value="">Nessuna</option>
                        {serviceOptions.map(o => (
                          <option key={o.optionId ?? o.id} value={o.optionId ?? o.id}>
                            {o.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  ) : (
                    <Form.Group className="mb-2">
                      <Form.Label>OptionId (facoltativo)</Form.Label>
                      <Form.Control value={form.serviceOptionId ?? ""} onChange={e => onChange("serviceOptionId", e.target.value || null)} />
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

                  <div className="d-flex gap-2 flex-wrap mt-1">
                    <Button className="ag-btn ag-btn--soft" size="sm" disabled={!form.serviceId || !form.startTime} onClick={fetchAvailSlots} type="button">
                      Suggerisci slot liberi
                    </Button>
                    {selectedService?.durationMin && (
                      <span className="ag-mini">
                        Durata: <b>{selectedService.durationMin} min</b>
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
                            className="ag-slot"
                            type="button"
                            onClick={() => {
                              const dateISO = form.startTime.slice(0, 10);
                              onChange("startTime", `${dateISO}T${s.start}`);
                            }}
                          >
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
        </div>

        <footer className="ag-modal__footer ag-dialog__footer">
          <Button className="ag-btn ag-btn--ghost" onClick={onHide} type="button">
            Annulla
          </Button>
          <Button className="ag-btn ag-btn--primary" onClick={submit} type="button">
            {isEdit ? "Salva modifiche" : "Crea appuntamento"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
