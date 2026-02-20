import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { getTimelineDay, getBookingsDay, patchBookingStatus, deleteBooking, updateBooking } from "../../api/modules/adminAgenda.api";
import BookingModal from "./BookingModal";
import { createBooking } from "../../api/modules/bookings.api";
import { fetchServices } from "../../api/modules/services.api";

const pad2 = n => String(n).padStart(2, "0");
const toISODate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromISODateLocal = iso => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
const minutes = hhmm => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtTime = dt => new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const STATUS_META = {
  PENDING: { label: "In attesa", tone: "pending" },
  CONFIRMED: { label: "Confermato", tone: "confirmed" },
  COMPLETED: { label: "Completato", tone: "completed" },
  CANCELLED: { label: "Cancellato", tone: "cancelled" },
};

function StatusPill({ status }) {
  const s = STATUS_META[status] || { label: status, tone: "neutral" };
  return <span className={`ag-pill ag-pill--${s.tone}`}>{s.label}</span>;
}

/** ---------- Timeline ---------- */
function TimelineDay({ dateISO, data }) {
  const viewWindow = useMemo(() => {
    const fallback = { startMin: 8 * 60, endMin: 20 * 60 };
    if (!data?.openRanges?.length) return fallback;

    const minStart = Math.min(...data.openRanges.map(r => minutes(r.start)));
    const maxEnd = Math.max(...data.openRanges.map(r => minutes(r.end)));

    const startMin = clamp(minStart - 30, 0, 24 * 60);
    const endMin = clamp(maxEnd + 30, 0, 24 * 60);

    if (endMin - startMin < 6 * 60) return fallback;
    return { startMin, endMin };
  }, [data]);

  const toPct = useCallback(m => ((m - viewWindow.startMin) / (viewWindow.endMin - viewWindow.startMin)) * 100, [viewWindow.endMin, viewWindow.startMin]);

  const renderBlock = (slot, kind, idx) => {
    const start = minutes(slot.start);
    const end = minutes(slot.end);
    if (end <= viewWindow.startMin || start >= viewWindow.endMin) return null;

    const top = toPct(Math.max(start, viewWindow.startMin));
    const height = toPct(Math.min(end, viewWindow.endMin)) - top;

    const cls = kind === "open" ? "ag-tl-block ag-tl-open" : kind === "closure" ? "ag-tl-block ag-tl-closure" : "ag-tl-block ag-tl-booking";

    return <div key={`${kind}-${idx}`} className={cls} style={{ top: `${top}%`, height: `${Math.max(height, 0)}%` }} />;
  };

  const hourMarks = useMemo(() => {
    const marks = [];
    const startHour = Math.ceil(viewWindow.startMin / 60);
    const endHour = Math.floor(viewWindow.endMin / 60);
    for (let h = startHour; h <= endHour; h++) {
      const m = h * 60;
      const pct = toPct(m);
      marks.push({ h, pct });
    }
    return marks;
  }, [toPct, viewWindow.endMin, viewWindow.startMin]);

  if (!data) {
    return (
      <Card className="ag-card">
        <Card.Body className="ag-card__body">
          <div className="d-flex align-items-center gap-2">
            <Spinner size="sm" />
            <span className="text-muted">Caricamento timeline…</span>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="ag-card">
      <Card.Body className="ag-card__body">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="ag-title">Timeline</div>
          <div className="ag-subtitle">{dateISO}</div>
        </div>

        <div className="ag-timeline">
          <div className="ag-timeline__labels">
            {hourMarks.map(m => (
              <div key={m.h} className="ag-hour" style={{ top: `${m.pct}%` }}>
                {pad2(m.h)}:00
              </div>
            ))}
          </div>

          <div className="ag-timeline__col">
            {hourMarks.map(m => (
              <div key={m.h} className="ag-gridline" style={{ top: `${m.pct}%` }} />
            ))}

            {data.openRanges?.map((s, i) => renderBlock(s, "open", i))}
            {data.closureRanges?.map((s, i) => renderBlock(s, "closure", i))}
            {data.bookingRanges?.map((s, i) => renderBlock(s, "booking", i))}
          </div>
        </div>

        <div className="ag-legend">
          <span className="ag-dot ag-dot--open" /> Open
          <span className="ag-dot ag-dot--closure" /> Chiusure
          <span className="ag-dot ag-dot--booking" /> Prenotazioni
        </div>
      </Card.Body>
    </Card>
  );
}

/** ---------- Pagina ---------- */
export default function AdminAgendaPage() {
  const [date, setDate] = useState(() => new Date());
  const dateISO = useMemo(() => toISODate(date), [date]);

  const [timeline, setTimeline] = useState(null);
  const [bookings, setBookings] = useState([]);

  const [err, setErr] = useState("");
  const [errDetails, setErrDetails] = useState(null);

  const [loading, setLoading] = useState(false);

  const [services, setServices] = useState([]);
  const [servicesErr, setServicesErr] = useState("");

  const [q, setQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create | edit
  const [selected, setSelected] = useState(null);

  const dayStrip = useMemo(() => {
    const base = fromISODateLocal(dateISO);
    const out = [];
    for (let i = -3; i <= 3; i++) out.push(addDays(base, i));
    return out;
  }, [dateISO]);

  const loadServices = useCallback(async () => {
    setServicesErr("");
    try {
      const list = await fetchServices();
      const arr = Array.isArray(list) ? list : list?.content ?? [];

      const norm = arr
        .map(s => ({
          serviceId: s.serviceId ?? s.id,
          title: s.title ?? s.name,
          durationMin: s.durationMin ?? s.duration ?? s.minutes,
          price: s.price ?? s.cost ?? null,
          options: s.options ?? s.serviceOptions ?? s.serviceOptionList ?? [],
        }))
        .filter(s => s.serviceId);

      setServices(norm);
    } catch (e) {
      setServicesErr(e.message);
    }
  }, []);

  const refresh = useCallback(async () => {
    setErr("");
    setErrDetails(null);
    setLoading(true);

    try {
      const [tl, bk] = await Promise.all([getTimelineDay(dateISO), getBookingsDay(dateISO)]);
      setTimeline(tl);

      const sorted = (bk || []).slice().sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setBookings(sorted);
    } catch (e) {
      setErr(e.message || "Errore nel caricamento agenda.");
    } finally {
      setLoading(false);
    }
  }, [dateISO]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return bookings;
    return bookings.filter(b => {
      const hay = [b.customerName, b.customerPhone, b.customerEmail, b.serviceTitle, b.optionName, b.status].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [bookings, q]);

  const kpi = useMemo(() => {
    const active = bookings.filter(b => b.status !== "CANCELLED");
    const count = active.length;

    const bookedMin = active.reduce((sum, b) => {
      const s = new Date(b.startTime).getTime();
      const e = new Date(b.endTime).getTime();
      const m = Math.max(0, Math.round((e - s) / 60000));
      return sum + m;
    }, 0);

    const openMin = (timeline?.openRanges || []).reduce((sum, r) => sum + Math.max(0, minutes(r.end) - minutes(r.start)), 0);
    const occ = openMin > 0 ? Math.round((bookedMin / openMin) * 100) : 0;

    const priceMap = new Map(services.map(s => [String(s.serviceId), Number(s.price)]));
    const revenue = active.reduce((sum, b) => {
      const p = priceMap.get(String(b.serviceId));
      return sum + (Number.isFinite(p) ? p : 0);
    }, 0);
    const revenueKnown = active.some(b => Number.isFinite(priceMap.get(String(b.serviceId))));

    return { count, bookedMin, openMin, occ, revenue, revenueKnown };
  }, [bookings, timeline, services]);

  const openCreate = () => {
    setModalMode("create");
    setSelected(null);
    setModalOpen(true);
  };

  const openEdit = b => {
    setModalMode("edit");
    setSelected(b);
    setModalOpen(true);
  };

  const changeStatus = async (id, status) => {
    setErr("");
    setErrDetails(null);
    try {
      await patchBookingStatus(id, status);
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  };

  const removeBooking = async id => {
    if (!confirm("Vuoi davvero eliminare questo appuntamento?")) return;
    setErr("");
    setErrDetails(null);
    try {
      await deleteBooking(id);
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  };

  const submitModal = async payload => {
    setErr("");
    setErrDetails(null);

    try {
      if (modalMode === "edit" && selected?.bookingId) {
        await updateBooking(selected.bookingId, payload);
      } else {
        await createBooking(payload);
      }

      setModalOpen(false);
      setSelected(null);
      await refresh();
    } catch (e) {
      console.error("SAVE BOOKING ERROR:", e);
      setErr(e.message || "Errore salvataggio appuntamento.");
    }
  };

  return (
    <Container fluid className="ag-page py-3">
      <Row className="g-3 align-items-stretch">
        {/* LEFT */}
        <Col lg={4}>
          <Card className="ag-card">
            <Card.Body className="ag-card__body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="ag-title">Agenda</div>
                  <div className="ag-subtitle">Gestione appuntamenti</div>
                </div>
                <Button className="ag-btn ag-btn--primary" onClick={openCreate}>
                  + Nuovo
                </Button>
              </div>

              <div className="ag-strip mt-3">
                <button className="ag-iconbtn" onClick={() => setDate(d => addDays(d, -7))} title="Settimana precedente">
                  ‹
                </button>

                <div className="ag-strip__days">
                  {dayStrip.map(d => {
                    const iso = toISODate(d);
                    const isActive = iso === dateISO;
                    const dow = d.toLocaleDateString("it-IT", { weekday: "short" });
                    const dd = d.getDate();

                    return (
                      <button key={iso} className={`ag-daychip ${isActive ? "is-active" : ""}`} onClick={() => setDate(d)} type="button">
                        <span className="ag-daychip__dow">{dow}</span>
                        <span className="ag-daychip__dd">{dd}</span>
                      </button>
                    );
                  })}
                </div>

                <button className="ag-iconbtn" onClick={() => setDate(d => addDays(d, 7))} title="Settimana successiva">
                  ›
                </button>
              </div>

              <div className="d-flex gap-2 mt-3 flex-wrap">
                <Button className="ag-btn ag-btn--soft" size="sm" onClick={() => setDate(d => addDays(d, -1))}>
                  ← Giorno prima
                </Button>
                <Button className="ag-btn ag-btn--ghost" size="sm" onClick={() => setDate(new Date())}>
                  Oggi
                </Button>
                <Button className="ag-btn ag-btn--soft" size="sm" onClick={() => setDate(d => addDays(d, 1))}>
                  Giorno dopo →
                </Button>

                <div className="ms-auto">
                  <Form.Control className="ag-date" type="date" value={dateISO} onChange={e => setDate(fromISODateLocal(e.target.value))} />
                </div>
              </div>

              <div className="ag-kpi mt-3">
                <div className="ag-kpi__item">
                  <div className="ag-kpi__label">Appuntamenti</div>
                  <div className="ag-kpi__value">{kpi.count}</div>
                </div>
                <div className="ag-kpi__item">
                  <div className="ag-kpi__label">Minuti prenotati</div>
                  <div className="ag-kpi__value">{kpi.bookedMin}</div>
                </div>
                <div className="ag-kpi__item">
                  <div className="ag-kpi__label">Occupazione</div>
                  <div className="ag-kpi__value">{kpi.openMin ? `${kpi.occ}%` : "—"}</div>
                </div>
                <div className="ag-kpi__item">
                  <div className="ag-kpi__label">Incasso stimato</div>
                  <div className="ag-kpi__value">{kpi.revenueKnown ? `€${kpi.revenue.toFixed(0)}` : "—"}</div>
                </div>
              </div>

              {servicesErr && (
                <Alert variant="warning" className="mt-3 mb-0">
                  {servicesErr}
                </Alert>
              )}

              {err && (
                <Alert variant="danger" className="mt-3 mb-0">
                  <div className="fw-semibold">{err}</div>
                  {errDetails && <pre className="ag-pre mt-2 mb-0">{typeof errDetails === "string" ? errDetails : JSON.stringify(errDetails, null, 2)}</pre>}
                </Alert>
              )}
            </Card.Body>
          </Card>

          <div className="mt-3">
            <TimelineDay dateISO={dateISO} data={timeline} />
          </div>
        </Col>

        {/* RIGHT */}
        <Col lg={8}>
          <Card className="ag-card h-100">
            <Card.Body className="ag-card__body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <div className="ag-title">Appuntamenti</div>
                  <div className="ag-subtitle">
                    {dateISO} · {filtered.length} risultati
                  </div>
                </div>

                <div className="d-flex gap-2 align-items-center">
                  <Form.Control className="ag-search" placeholder="Cerca cliente, telefono, servizio…" value={q} onChange={e => setQ(e.target.value)} />
                  <Button className="ag-btn ag-btn--ghost" onClick={refresh} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : "Aggiorna"}
                  </Button>
                </div>
              </div>

              <div className="ag-list">
                {filtered.map(b => (
                  <div key={b.bookingId} className="ag-item">
                    <div className="ag-item__time">
                      <div className="ag-item__timeMain">
                        {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                      </div>
                      <div className="ag-item__timeSub">{Math.max(0, Math.round((new Date(b.endTime) - new Date(b.startTime)) / 60000))} min</div>
                    </div>

                    <div className="ag-item__main">
                      <div className="ag-item__top">
                        <div className="ag-item__name">{b.customerName}</div>
                        <StatusPill status={b.status} />
                      </div>

                      <div className="ag-item__meta">
                        <span className="ag-muted">{b.customerPhone}</span>
                        <span className="ag-dotsep">•</span>
                        <span className="ag-muted">{b.customerEmail}</span>
                      </div>

                      <div className="ag-item__service">
                        <span className="ag-service">{b.serviceTitle || "—"}</span>
                        {b.optionName ? <span className="ag-option"> · {b.optionName}</span> : null}
                        {b.notes ? <span className="ag-notes"> · {b.notes}</span> : null}
                      </div>
                    </div>

                    <div className="ag-item__actions">
                      <Button className="ag-btn ag-btn--soft" size="sm" onClick={() => openEdit(b)}>
                        Modifica
                      </Button>

                      {b.status === "PENDING" && (
                        <Button className="ag-btn ag-btn--primary" size="sm" onClick={() => changeStatus(b.bookingId, "CONFIRMED")}>
                          Conferma
                        </Button>
                      )}

                      {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                        <Button className="ag-btn ag-btn--ok" size="sm" onClick={() => changeStatus(b.bookingId, "COMPLETED")}>
                          Completa
                        </Button>
                      )}

                      {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                        <Button className="ag-btn ag-btn--ghost" size="sm" onClick={() => changeStatus(b.bookingId, "CANCELLED")}>
                          Annulla
                        </Button>
                      )}

                      <Button className="ag-btn ag-btn--danger" size="sm" onClick={() => removeBooking(b.bookingId)}>
                        Elimina
                      </Button>
                    </div>
                  </div>
                ))}

                {!filtered.length && (
                  <div className="ag-empty">
                    <div className="ag-empty__title">Nessun appuntamento</div>
                    <div className="ag-empty__text">Per questo giorno non risultano prenotazioni.</div>
                    <Button className="ag-btn ag-btn--primary mt-2" onClick={openCreate}>
                      + Inserisci appuntamento
                    </Button>
                  </div>
                )}
              </div>

              <div className="ag-footnote mt-2">Tip: “Modifica” apre la scheda completa. Per i walk-in puoi creare velocemente senza email.</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <BookingModal
        show={modalOpen}
        onHide={() => setModalOpen(false)}
        mode={modalMode}
        initial={modalMode === "edit" ? selected : null}
        services={services}
        onSubmit={submitModal}
      />
    </Container>
  );
}
