import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { getAvailSlotsForServiceDay } from "../../api/modules/adminAgenda.api";

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

    // se NON è walk-in, vogliamo email compilata
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

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static" keyboard={false} scrollable dialogClassName="ag-modal-dialog" contentClassName="ag-modal">
      <Modal.Header closeButton className="ag-modal__header">
        <Modal.Title className="ag-modal__title">{isEdit ? "Modifica appuntamento" : "Nuovo appuntamento"}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="ag-modal__body">
        <Row className="g-3">
          <Col md={7}>
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
                          // se lo disattiva, vuole email vera
                          onChange("customerEmail", form.customerEmail || "");
                        } else {
                          // se lo attiva, togliamo errore email
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

          <Col md={5}>
            <div className="ag-section">
              <div className="ag-section__title">Orario & servizio</div>

              <Form noValidate>
                <Form.Group className="mb-2">
                  <Form.Label>Servizio *</Form.Label>
                  <Form.Select value={form.serviceId} onChange={e => onChange("serviceId", e.target.value)} isInvalid={submitted && !!errors.serviceId}>
                    <option value="">Seleziona…</option>
                    {(services || []).map(s => (
                      <option key={s.serviceId} value={s.serviceId}>
                        {s.title}
                        {s.durationMin ? ` · ${s.durationMin} min` : ""}
                        {s.price != null ? ` · €${Number(s.price).toFixed(0)}` : ""}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.serviceId}</Form.Control.Feedback>
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
                    <div className="ag-help mb-1">Click su uno slot per impostare l’orario:</div>
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
      </Modal.Body>

      <Modal.Footer className="ag-modal__footer">
        <Button className="ag-btn ag-btn--ghost" onClick={onHide} type="button">
          Annulla
        </Button>
        <Button className="ag-btn ag-btn--primary" onClick={submit} type="button">
          {isEdit ? "Salva modifiche" : "Crea appuntamento"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
