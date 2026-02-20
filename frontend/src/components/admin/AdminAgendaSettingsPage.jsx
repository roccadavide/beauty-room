import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Container, Form, Modal, Row, Tab, Tabs, Table } from "react-bootstrap";
import * as adminAgendaApi from "../../api/modules/adminAgenda.api";

const pad2 = n => String(n).padStart(2, "0");
const toISODate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function monthRangeISO(date) {
  const d = new Date(date);
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const toExclusive = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { from: toISODate(from), to: toISODate(toExclusive) };
}

function ClosureModal({ show, onHide, initial, onSave }) {
  const [form, setForm] = useState({
    date: "",
    startTime: "",
    endTime: "",
    reason: "",
    fullDay: false,
  });

  useEffect(() => {
    if (!initial) {
      setForm({ date: "", startTime: "", endTime: "", reason: "", fullDay: false });
      return;
    }
    setForm({
      date: initial.date || "",
      startTime: initial.startTime || "",
      endTime: initial.endTime || "",
      reason: initial.reason || "",
      fullDay: initial.fullDay || false,
    });
  }, [initial]);

  const payload = {
    date: form.date,
    startTime: form.fullDay ? null : form.startTime || null,
    endTime: form.fullDay ? null : form.endTime || null,
    reason: form.reason,
  };

  const canSave = form.date && form.reason && (form.fullDay || (form.startTime && form.endTime));

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{initial?.id ? "Modifica chiusura" : "Nuova chiusura"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="d-grid gap-2">
          <Form.Group>
            <Form.Label>Data</Form.Label>
            <Form.Control type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </Form.Group>

          <Form.Check type="switch" label="Intera giornata" checked={form.fullDay} onChange={e => setForm(f => ({ ...f, fullDay: e.target.checked }))} />

          {!form.fullDay && (
            <Row>
              <Col>
                <Form.Group>
                  <Form.Label>Start</Form.Label>
                  <Form.Control type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group>
                  <Form.Label>End</Form.Label>
                  <Form.Control type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </Form.Group>
              </Col>
            </Row>
          )}

          <Form.Group>
            <Form.Label>Motivo</Form.Label>
            <Form.Control value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Annulla
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={() => onSave(payload)}>
          Salva
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function WorkingHoursModal({ show, onHide, wh, onSave }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!wh) return;
    setForm({
      dayOfWeek: wh.dayOfWeek,
      closed: wh.closed,
      morningStart: wh.morningStart || "",
      morningEnd: wh.morningEnd || "",
      afternoonStart: wh.afternoonStart || "",
      afternoonEnd: wh.afternoonEnd || "",
    });
  }, [wh]);

  if (!form) return null;

  const canSave = form.closed || (!!form.morningStart && !!form.morningEnd) || (!!form.afternoonStart && !!form.afternoonEnd);

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Orari: {form.dayOfWeek}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="d-grid gap-2">
          <Form.Check type="switch" label="Giorno chiuso" checked={!!form.closed} onChange={e => setForm(f => ({ ...f, closed: e.target.checked }))} />

          {!form.closed && (
            <>
              <Row>
                <Col>
                  <Form.Group>
                    <Form.Label>Mattina start</Form.Label>
                    <Form.Control type="time" value={form.morningStart} onChange={e => setForm(f => ({ ...f, morningStart: e.target.value }))} />
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group>
                    <Form.Label>Mattina end</Form.Label>
                    <Form.Control type="time" value={form.morningEnd} onChange={e => setForm(f => ({ ...f, morningEnd: e.target.value }))} />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col>
                  <Form.Group>
                    <Form.Label>Pomeriggio start</Form.Label>
                    <Form.Control type="time" value={form.afternoonStart} onChange={e => setForm(f => ({ ...f, afternoonStart: e.target.value }))} />
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group>
                    <Form.Label>Pomeriggio end</Form.Label>
                    <Form.Control type="time" value={form.afternoonEnd} onChange={e => setForm(f => ({ ...f, afternoonEnd: e.target.value }))} />
                  </Form.Group>
                </Col>
              </Row>
            </>
          )}
        </Form>
        <div className="text-muted small mt-2">Se “chiuso”, gli orari vengono nullati dal backend.</div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Annulla
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={() => onSave(form)}>
          Salva
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function AdminAgendaSettingsPage() {
  const [err, setErr] = useState("");

  // closures month loader
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const monthLabel = useMemo(() => monthCursor.toLocaleString("it-IT", { month: "long", year: "numeric" }), [monthCursor]);
  const { from, to } = useMemo(() => monthRangeISO(monthCursor), [monthCursor]);

  const [closures, setClosures] = useState([]);
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState(null);

  // working hours
  const [workingHours, setWorkingHours] = useState([]);
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState(null);

  const refreshClosures = useCallback(async () => {
    setErr("");
    try {
      const list = await adminAgendaApi.getClosuresRange(from, to);
      setClosures(list);
    } catch (e) {
      setErr(e?.normalized?.message || "Errore closures.");
    }
  }, [from, to]);

  const refreshWH = useCallback(async () => {
    setErr("");
    try {
      const list = await adminAgendaApi.getWorkingHoursAll();
      // ordina lun->dom
      const order = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
      list.sort((a, b) => order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek));
      setWorkingHours(list);
    } catch (e) {
      setErr(e?.normalized?.message || "Errore working hours.");
    }
  }, []);

  useEffect(() => {
    refreshClosures();
  }, [refreshClosures]);
  useEffect(() => {
    refreshWH();
  }, [refreshWH]);

  const saveClosure = async payload => {
    setErr("");
    try {
      if (editingClosure?.id) await adminAgendaApi.updateClosure(editingClosure.id, payload);
      else await adminAgendaApi.createClosure(payload);
      setClosureModalOpen(false);
      setEditingClosure(null);
      await refreshClosures();
    } catch (e) {
      setErr(e?.normalized?.message || "Errore salvataggio closure.");
    }
  };

  const deleteClosure = async id => {
    if (!confirm("Eliminare la chiusura?")) return;
    setErr("");
    try {
      await adminAgendaApi.deleteClosure(id);
      await refreshClosures();
    } catch (e) {
      setErr(e?.normalized?.message || "Errore delete closure.");
    }
  };

  const initWeek = async () => {
    setErr("");
    try {
      await adminAgendaApi.initDefaultWeek();
      await refreshWH();
    } catch (e) {
      setErr(e?.normalized?.message || "Errore init week.");
    }
  };

  const saveWH = async payload => {
    setErr("");
    try {
      await adminAgendaApi.updateWorkingHours(editingWh.id, payload);
      setWhModalOpen(false);
      setEditingWh(null);
      await refreshWH();
    } catch (e) {
      setErr(e?.normalized?.message || "Errore update working hours.");
    }
  };

  return (
    <Container fluid className="py-3">
      {err && <Alert variant="danger">{err}</Alert>}

      <Card className="adm-glass p-3">
        <div className="d-flex align-items-center justify-content-between">
          <div className="fw-semibold">Orari & Chiusure</div>
          <Badge bg="secondary" className="opacity-75">
            Admin
          </Badge>
        </div>

        <Tabs defaultActiveKey="working-hours" className="mt-3">
          <Tab eventKey="working-hours" title="Working Hours">
            <div className="d-flex align-items-center justify-content-between mt-3">
              <div className="text-muted small">Settimana lavorativa (7 giorni)</div>
              <Button variant="outline-light" size="sm" onClick={initWeek}>
                Init default week
              </Button>
            </div>

            <div className="table-responsive mt-3">
              <Table hover borderless className="mb-0 align-middle">
                <thead className="text-muted small">
                  <tr>
                    <th>Giorno</th>
                    <th>Mattina</th>
                    <th>Pomeriggio</th>
                    <th>Stato</th>
                    <th className="text-end">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {workingHours.map(wh => (
                    <tr key={wh.id}>
                      <td className="fw-semibold">{wh.dayOfWeek}</td>
                      <td>{wh.morningStart && wh.morningEnd ? `${wh.morningStart} - ${wh.morningEnd}` : "—"}</td>
                      <td>{wh.afternoonStart && wh.afternoonEnd ? `${wh.afternoonStart} - ${wh.afternoonEnd}` : "—"}</td>
                      <td>{wh.closed ? <Badge bg="secondary">Closed</Badge> : <Badge bg="success">Open</Badge>}</td>
                      <td className="text-end">
                        <Button
                          size="sm"
                          variant="outline-light"
                          onClick={() => {
                            setEditingWh(wh);
                            setWhModalOpen(true);
                          }}
                        >
                          Modifica
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!workingHours.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        Nessun working hours trovato. Usa “Init default week”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Tab>

          <Tab eventKey="closures" title="Closures">
            <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <Button size="sm" variant="outline-light" onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                  ←
                </Button>
                <div className="fw-semibold text-capitalize">{monthLabel}</div>
                <Button size="sm" variant="outline-light" onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                  →
                </Button>
              </div>

              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setEditingClosure(null);
                  setClosureModalOpen(true);
                }}
              >
                + Nuova chiusura
              </Button>
            </div>

            <div className="text-muted small mt-2">
              Caricamento range: <span className="fw-semibold">{from}</span> → <span className="fw-semibold">{to}</span> (to esclusivo)
            </div>

            <div className="table-responsive mt-3">
              <Table hover borderless className="mb-0 align-middle">
                <thead className="text-muted small">
                  <tr>
                    <th>Data</th>
                    <th>Fascia</th>
                    <th>Motivo</th>
                    <th className="text-end">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {closures.map(c => (
                    <tr key={c.id}>
                      <td className="fw-semibold">{c.date}</td>
                      <td>{c.fullDay ? <Badge bg="danger">Full day</Badge> : `${c.startTime} - ${c.endTime}`}</td>
                      <td>{c.reason}</td>
                      <td className="text-end">
                        <div className="d-flex gap-2 justify-content-end">
                          <Button
                            size="sm"
                            variant="outline-light"
                            onClick={() => {
                              setEditingClosure(c);
                              setClosureModalOpen(true);
                            }}
                          >
                            Modifica
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => deleteClosure(c.id)}>
                            Elimina
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!closures.length && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        Nessuna chiusura in questo mese.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Tab>
        </Tabs>
      </Card>

      <ClosureModal show={closureModalOpen} onHide={() => setClosureModalOpen(false)} initial={editingClosure} onSave={saveClosure} />

      <WorkingHoursModal show={whModalOpen} onHide={() => setWhModalOpen(false)} wh={editingWh} onSave={saveWH} />

      <style>{`
        .adm-glass{
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.14);
          backdrop-filter: blur(12px);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.12);
          color: rgba(255,255,255,.92);
        }
      `}</style>
    </Container>
  );
}
