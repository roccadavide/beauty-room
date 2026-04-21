import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { getTimelineDay, getBookingsDay, patchBookingStatus, deleteBooking, updateBooking, getNextAvailableSlot, patchBookingPadding, refundBooking, patchBookingConsent } from "../../api/modules/adminAgenda.api";
import BookingModal from "./BookingModal";
import BookingSalePanel from "./BookingSalePanel";
import WeeklyCalendar from "./WeeklyCalendar";
import { createAdminBooking } from "../../api/modules/bookings.api";
import { fetchServices } from "../../api/modules/services.api";
import DateTimeField from "../common/DateTimeField";
import SEO from "../common/SEO";

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

const openWhatsApp = phone => {
  if (!phone) return;
  const clean = phone.replace(/[\s\-().+]/g, "");
  const number = clean.startsWith("39") ? clean : `39${clean}`;
  window.open(`https://wa.me/${number}`, "_blank", "noopener,noreferrer");
};

const STATUS_META = {
  PENDING: { label: "In attesa", tone: "pending" },
  PENDING_PAYMENT: { label: "Attesa pagamento", tone: "pending" },
  NO_SHOW: { label: "Non presentata", tone: "noshow" },
  CONFIRMED: { label: "Confermato", tone: "confirmed" },
  COMPLETED: { label: "Completato", tone: "completed" },
  CANCELLED: { label: "Cancellato", tone: "cancelled" },
};

function StatusPill({ status }) {
  const s = STATUS_META[status] || { label: status, tone: "neutral" };
  return <span className={`ag-pill ag-pill--${s.tone}`}>{s.label}</span>;
}

// Abbrevia "Mario Rossi" → "Mario R."
function shortCustomerName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** ---------- Timeline ---------- */
function TimelineDay({ dateISO, data, bookings = [], selectedBookingId, onBookingClick }) {
  const timelineRef = useRef(null);
  const nowLineRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);

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

  // Mappa "HH:mm" → booking per collegare i blocchi timeline alla lista
  const bookingMap = useMemo(() => {
    const m = new Map();
    (bookings || []).forEach(b => {
      const tStart = b.startTime?.slice(11, 16);
      if (tStart) m.set(tStart, b);
    });
    return m;
  }, [bookings]);

  const renderBlock = (slot, kind, idx) => {
    const start = minutes(slot.start);
    const end = minutes(slot.end);
    if (end <= viewWindow.startMin || start >= viewWindow.endMin) return null;
    const top = toPct(Math.max(start, viewWindow.startMin));
    const height = toPct(Math.min(end, viewWindow.endMin)) - top;

    if (kind !== "booking") {
      const cls = kind === "open" ? "ag-tl-block ag-tl-open" : "ag-tl-block ag-tl-closure";
      return <div key={`${kind}-${idx}`} className={cls} style={{ top: `${top}%`, height: `${Math.max(height, 0)}%` }} />;
    }

    // Booking block — arricchito con dati cliente/servizio
    const booking = bookingMap.get(slot.start);
    const bookingId = booking?.bookingId;
    const isSelected = bookingId != null && bookingId === selectedBookingId;
    const durationMin = end - start;
    const isCompact = durationMin < 30;

    return (
      <div
        key={`${kind}-${idx}`}
        className={`ag-tl-block ag-tl-booking${booking ? " ag-tl-booking--clickable" : ""}${isSelected ? " ag-tl-booking--selected" : ""}`}
        style={{ top: `${top}%`, height: `${Math.max(height, 0)}%` }}
        role={booking ? "button" : undefined}
        tabIndex={booking ? 0 : undefined}
        title={booking ? `${booking.serviceTitle || ""} — ${booking.customerName || ""}` : undefined}
        onClick={
          booking
            ? e => {
                e.stopPropagation();
                onBookingClick?.(bookingId);
              }
            : undefined
        }
        onKeyDown={
          booking
            ? e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onBookingClick?.(bookingId);
                }
              }
            : undefined
        }
      >
        {booking &&
          (isCompact ? (
            <div className="ag-tl-booking__label ag-tl-booking__label--compact">
              <span className="ag-tl-booking__service">{booking.serviceTitle || "—"}</span>
              <span className="ag-tl-booking__dot"> · </span>
              <span className="ag-tl-booking__customer">{shortCustomerName(booking.customerName)}</span>
            </div>
          ) : (
            <div className="ag-tl-booking__label">
              <div className="ag-tl-booking__service">{booking.serviceTitle || "—"}</div>
              <div className="ag-tl-booking__customer">{shortCustomerName(booking.customerName)}</div>
            </div>
          ))}
      </div>
    );
  };

  const hourMarks = useMemo(() => {
    const marks = [];
    const startHour = Math.ceil(viewWindow.startMin / 60);
    const endHour = Math.floor(viewWindow.endMin / 60);
    for (let h = startHour; h <= endHour; h++) {
      marks.push({ h, pct: toPct(h * 60) });
    }
    return marks;
  }, [toPct, viewWindow.endMin, viewWindow.startMin]);

  useEffect(() => {
    const timelineEl = timelineRef.current;
    const lineEl = nowLineRef.current;
    if (!timelineEl || !lineEl || !data) return;

    const todayISO = toISODate(new Date());
    const isToday = dateISO === todayISO;

    if (!isToday) {
      lineEl.style.opacity = "0";
      hasAutoScrolledRef.current = false;
      return;
    }

    const updatePosition = () => {
      const rect = timelineEl.getBoundingClientRect();
      const containerHeight = rect.height;
      if (!containerHeight) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const { startMin, endMin } = viewWindow;
      if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return;

      const ratio = (clamp(currentMinutes, startMin, endMin) - startMin) / (endMin - startMin);
      const y = ratio * containerHeight;

      lineEl.style.opacity = "1";
      lineEl.style.transform = `translateY(${y}px)`;

      if (!hasAutoScrolledRef.current) {
        hasAutoScrolledRef.current = true;
        const lineRect = lineEl.getBoundingClientRect();
        const lineCenter = lineRect.top + lineRect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const delta = lineCenter - viewportCenter;
        if (Math.abs(delta) > 16) window.scrollBy({ top: delta, behavior: "smooth" });
      }
    };

    let frameId;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updatePosition);
    };
    scheduleUpdate();
    const intervalId = window.setInterval(scheduleUpdate, 60 * 1000);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", scheduleUpdate);
      cancelAnimationFrame(frameId);
    };
  }, [dateISO, data, viewWindow]);

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
        <div ref={timelineRef} className="ag-timeline">
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
            <div ref={nowLineRef} className="ag-nowline" aria-hidden="true" />
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
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [services, setServices] = useState([]);
  const [servicesErr, setServicesErr] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selected, setSelected] = useState(null);

  const [viewMode, setViewMode] = useState("day");
  const [weekRefreshKey, setWeekRefreshKey] = useState(0);
  const [confirmModal, setConfirmModal] = useState(null);
  const [openSalePanel, setOpenSalePanel] = useState(null);
  const [paddingEditing, setPaddingEditing] = useState(null); // bookingId in edit
  const [paddingSaving, setPaddingSaving] = useState(null); // bookingId in saving
  const [paddingDraft, setPaddingDraft] = useState(0); // valore locale mentre si edita
  const [nextSlotDuration, setNextSlotDuration] = useState(60);
  const [nextSlotResult, setNextSlotResult] = useState(null);
  const [nextSlotLoading, setNextSlotLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const deleteIntervalRef = useRef(null);

  // ── Timeline ↔ Lista: highlight sincronizzato ────────────────────────────
  const [highlightedId, setHighlightedId] = useState(null);
  const itemRefsMap = useRef(new Map());

  const handleTimelineBookingClick = useCallback(bookingId => {
    setHighlightedId(prev => (prev === bookingId ? null : bookingId));
    const el = itemRefsMap.current.get(bookingId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // Azzera highlight al click fuori da blocchi timeline e lista
  useEffect(() => {
    if (!highlightedId) return;
    const onDoc = e => {
      if (!e.target.closest(".ag-tl-booking") && !e.target.closest(".ag-item")) {
        setHighlightedId(null);
      }
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [highlightedId]);

  // FIX B2: traccia se il cambio data è stato causato da una ricerca slot.
  // Senza questo ref, l'effect su dateISO azzera nextSlotResult appena
  // la ricerca cambia la data, rendendo "Ancora →" inutilizzabile.
  const dateChangedBySearchRef = useRef(false);

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
      const arr = Array.isArray(list) ? list : (list?.content ?? []);
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
    let result = bookings;
    const needle = q.trim().toLowerCase();
    if (needle) {
      result = result.filter(b => {
        const hay = [b.customerName, b.customerPhone, b.customerEmail, b.serviceTitle, b.optionName, b.status].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(needle);
      });
    }
    if (statusFilter.size > 0) {
      result = result.filter(b => {
        const s = b.status;
        if (statusFilter.has("PENDING") && (s === "PENDING" || s === "PENDING_PAYMENT")) return true;
        if (statusFilter.has("CONFIRMED") && s === "CONFIRMED") return true;
        if (statusFilter.has("COMPLETED") && s === "COMPLETED") return true;
        if (statusFilter.has("CANCELLED") && s === "CANCELLED") return true;
        return false;
      });
    }
    return result;
  }, [bookings, q, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    bookings.forEach(b => {
      const s = b.status;
      if (s === "PENDING" || s === "PENDING_PAYMENT") counts.pending += 1;
      else if (s === "CONFIRMED") counts.confirmed += 1;
      else if (s === "COMPLETED") counts.completed += 1;
      else if (s === "CANCELLED") counts.cancelled += 1;
    });
    return counts;
  }, [bookings]);

  // Per ogni booking calcola il gap massimo disponibile prima del prossimo appuntamento
  const paddingMaxMap = useMemo(() => {
    const map = new Map();
    const active = filtered.filter(b => b.status !== "CANCELLED");
    active.forEach((b, i) => {
      const nextActive = active.find((nb, ni) => ni > i && nb.status !== "CANCELLED");
      if (nextActive) {
        const gap = Math.floor((new Date(nextActive.startTime) - new Date(b.endTime)) / 60000);
        map.set(b.bookingId, Math.max(0, gap));
      } else {
        map.set(b.bookingId, 120); // nessun booking dopo: max 120 min
      }
    });
    return map;
  }, [filtered]);

  const agendaBusyDates = useMemo(() => {
    const m = new Map();
    bookings.forEach(b => {
      const iso = typeof b.startTime === "string" ? b.startTime.slice(0, 10) : "";
      if (!iso) return;
      m.set(iso, (m.get(iso) || 0) + 1);
    });
    return Array.from(m.entries()).map(([date, count]) => ({ date, count }));
  }, [bookings]);

  const kpi = useMemo(() => {
    const active = bookings.filter(b => b.status !== "CANCELLED");
    const count = active.length;
    const bookedMin = active.reduce((sum, b) => {
      const s = new Date(b.startTime).getTime();
      const e = new Date(b.endTime).getTime();
      return sum + Math.max(0, Math.round((e - s) / 60000));
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

  // FIX B2: azzerare nextSlotResult solo se il cambio data è stato manuale,
  // NON se è stato causato da searchNextSlot (altrimenti "Ancora →" si rompe)
  useEffect(() => {
    setStatusFilter(new Set());
    setHighlightedId(null);
    itemRefsMap.current.clear();
    if (dateChangedBySearchRef.current) {
      dateChangedBySearchRef.current = false;
      // Data cambiata da ricerca slot: NON azzeriamo il risultato
    } else {
      // Data cambiata manualmente: azzeriamo
      setNextSlotResult(null);
    }
  }, [dateISO]);

  const openCreate = () => {
    setModalMode("create");
    setSelected({ startTime: `${dateISO}T09:00` });
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

  const savePadding = async (bookingId, minutes) => {
    setPaddingSaving(bookingId);
    try {
      await patchBookingPadding(bookingId, minutes);
      await refresh();
      setPaddingEditing(null);
    } catch (e) {
      setErr(e.message || "Errore aggiornamento buffer.");
    } finally {
      setPaddingSaving(null);
    }
  };

  const removeBooking = booking => {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
      deleteBooking(pendingDelete.booking.bookingId).catch(() => {});
      setPendingDelete(null);
      setDeleteCountdown(5);
    }

    setBookings(prev => prev.filter(b => b.bookingId !== booking.bookingId));
    setConfirmModal(null);
    setDeleteCountdown(5);

    if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
    deleteIntervalRef.current = setInterval(() => {
      setDeleteCountdown(prev => {
        if (prev <= 1) {
          clearInterval(deleteIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timer = setTimeout(async () => {
      if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
      setPendingDelete(null);
      setErr("");
      setErrDetails(null);
      try {
        await deleteBooking(booking.bookingId);
        await refresh();
      } catch (e) {
        setBookings(prev => [...prev, booking].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
        setErr(e?.normalized?.message || e.message || "Errore durante l'eliminazione.");
        setErrDetails(e?.normalized || null);
      } finally {
        setDeleteCountdown(5);
      }
    }, 5000);

    setPendingDelete({ booking, timer });
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
    setBookings(prev => [...prev, pendingDelete.booking].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
    setPendingDelete(null);
    setDeleteCountdown(5);
  };

  const askDelete = b => {
    setConfirmModal({
      type: "delete",
      booking: b,
      bookingId: b.bookingId,
      customerName: b.customerName,
      stripeSessionId: b.stripeSessionId ?? null,
    });
  };

  const askCancel = b => {
    if (b?.stripeSessionId) {
      setErr("Questa prenotazione è stata pagata. Usa 'Rimborsa' per cancellarla e rimborsare il cliente.");
      setErrDetails(null);
      return;
    }
    setConfirmModal({ type: "cancel", bookingId: b.bookingId, customerName: b.customerName });
  };

  const handleRefund = async booking => {
    const confirmed = window.confirm(
      "Sei sicura di voler rimborsare questo appuntamento?\nIl cliente riceverà il rimborso su Stripe e una email di conferma."
    );
    if (!confirmed) return;

    setErr("");
    setErrDetails(null);
    setSuccessMsg("");

    try {
      await refundBooking(booking.bookingId);
      setSuccessMsg("Rimborso avviato con successo");
      await refresh();
      if (viewMode === "week") setWeekRefreshKey(k => k + 1);
    } catch (e) {
      setErr(e.message || "Errore durante il rimborso.");
    }
  };

  const signConsent = async b => {
    const confirmed = window.confirm(
      `Confermi che il consenso informato è stato firmato da ${b.customerName}?`
    );
    if (!confirmed) return;

    try {
      const updated = await patchBookingConsent(b.bookingId);
      // Aggiornamento locale ottimistico della card
      setBookings(prev =>
        prev.map(booking =>
          booking.bookingId === b.bookingId
            ? { ...booking, consentSigned: updated.consentSigned, consentSignedAt: updated.consentSignedAt }
            : booking
        )
      );
      setSuccessMsg("✅ Consenso PMU registrato");
    } catch (e) {
      setErr(e.message || "Errore durante la firma del consenso.");
    }
  };

  const submitModal = async payload => {
    setErr("");
    setErrDetails(null);
    try {
      if (modalMode === "edit" && selected?.bookingId) {
        await updateBooking(selected.bookingId, payload);
      } else {
        await createAdminBooking(payload);
      }
      setModalOpen(false);
      setSelected(null);
      await refresh();
      if (viewMode === "week") setWeekRefreshKey(k => k + 1);
    } catch (e) {
      console.error("SAVE BOOKING ERROR:", e);
      setErr(e.message || "Errore salvataggio appuntamento.");
    }
  };

  const handleWeekBookingClick = booking => {
    setModalMode("edit");
    setSelected(booking);
    setModalOpen(true);
  };
  const handleWeekDayClick = iso => {
    setDate(fromISODateLocal(iso));
    setViewMode("day");
  };
  const handleSlotClick = (iso, hour) => {
    setModalMode("create");
    setSelected({ startTime: `${iso}T${pad2(hour)}:00` });
    setModalOpen(true);
  };

  const toggleStatus = key => {
    setStatusFilter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const clearStatusFilters = () => setStatusFilter(new Set());
  const hasStatusFilter = statusFilter.size > 0;

  // FIX B2: imposta il ref PRIMA di cambiare la data
  const searchNextSlot = async (afterISO = null) => {
    setNextSlotLoading(true);
    setNextSlotResult(null);
    try {
      const res = await getNextAvailableSlot(nextSlotDuration, afterISO);
      setNextSlotResult(res);
      if (res?.found && res.slot?.date) {
        dateChangedBySearchRef.current = true; // ← FIX B2: segnala che il cambio data è nostro
        setDate(fromISODateLocal(res.slot.date));
        setViewMode("day");
      }
    } catch (e) {
      setNextSlotResult({ found: false, error: e.message });
    } finally {
      setNextSlotLoading(false);
    }
  };

  const searchNextSlotAgain = () => {
    if (!nextSlotResult?.found || !nextSlotResult.slot) return;
    const { date: slotDate, slotEnd } = nextSlotResult.slot;
    if (!slotDate || !slotEnd) return;
    searchNextSlot(`${slotDate}T${slotEnd.slice(0, 5)}:00`);
  };

  useEffect(() => {
    return () => {
      if (pendingDelete?.timer) clearTimeout(pendingDelete.timer);
      if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
    };
  }, [pendingDelete]);

  return (
    <Container fluid className="ag-page py-3">
      <SEO title="Agenda" noindex={true} />
      <Row className="g-3 align-items-stretch">
        {/* LEFT */}
        <Col lg={4}>
          <Card className="ag-card">
            <Card.Body className="ag-card__body">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <div>
                    <div className="ag-title">Agenda</div>
                    <div className="ag-subtitle">Gestione appuntamenti</div>
                  </div>
                  <div className="ag-view-toggle">
                    <button type="button" className={`ag-view-toggle__btn ${viewMode === "day" ? "is-active" : ""}`} onClick={() => setViewMode("day")}>
                      Giorno
                    </button>
                    <button type="button" className={`ag-view-toggle__btn ${viewMode === "week" ? "is-active" : ""}`} onClick={() => setViewMode("week")}>
                      Settimana
                    </button>
                  </div>
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
                    return (
                      <button key={iso} className={`ag-daychip ${isActive ? "is-active" : ""}`} onClick={() => setDate(d)} type="button">
                        <span className="ag-daychip__dow">{dow}</span>
                        <span className="ag-daychip__dd">{d.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
                <button className="ag-iconbtn" onClick={() => setDate(d => addDays(d, 7))} title="Settimana successiva">
                  ›
                </button>
              </div>

              <div className="ag-toolbar-nav mt-3">
                <div className="ag-toolbar-nav__btns">
                  <Button className="ag-btn ag-btn--soft" size="sm" onClick={() => setDate(d => addDays(d, -1))}>
                    ← Giorno prima
                  </Button>
                  <Button className="ag-btn ag-btn--ghost" size="sm" onClick={() => setDate(new Date())}>
                    Oggi
                  </Button>
                  <Button className="ag-btn ag-btn--soft" size="sm" onClick={() => setDate(d => addDays(d, 1))}>
                    Giorno dopo →
                  </Button>
                </div>
                <div className="ag-date-wrap">
                  <DateTimeField
                    mode="date"
                    value={dateISO}
                    onChange={iso => setDate(fromISODateLocal(iso))}
                    busyDates={agendaBusyDates}
                    placeholder="Vai a data…"
                    className="ag-date-dtf"
                  />
                </div>
              </div>

              <div className="ag-nextslot mt-3">
                <div className="ag-nextslot__row">
                  <div className="ag-nextslot__chips">
                    {[30, 45, 60, 90, 120].map(m => (
                      <button
                        key={m}
                        type="button"
                        className={`ag-nextslot__chip ${nextSlotDuration === m ? "is-active" : ""}`}
                        onClick={() => {
                          setNextSlotDuration(m);
                          setNextSlotResult(null);
                        }}
                      >
                        {m < 60 ? `${m}′` : m === 60 ? "1h" : m === 90 ? "1h30′" : "2h"}
                      </button>
                    ))}
                    <input
                      type="number"
                      className="ag-nextslot__custom"
                      min={15}
                      max={480}
                      step={5}
                      value={![30, 45, 60, 90, 120].includes(nextSlotDuration) ? nextSlotDuration : ""}
                      placeholder="…′"
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v) && v >= 15 && v <= 480) {
                          setNextSlotDuration(v);
                          setNextSlotResult(null);
                        }
                      }}
                    />
                  </div>
                  <button type="button" className="ag-btn ag-btn--soft ag-nextslot__search" disabled={nextSlotLoading} onClick={() => searchNextSlot(null)}>
                    {nextSlotLoading ? "…" : "🔍 Prossima"}
                  </button>
                </div>

                {nextSlotResult && (
                  <div className={`ag-nextslot__result ${nextSlotResult.found ? "ag-nextslot__result--found" : "ag-nextslot__result--none"}`}>
                    {nextSlotResult.found && nextSlotResult.slot ? (
                      <>
                        <span className="ag-nextslot__result-text">
                          📅 <b>{new Date(nextSlotResult.slot.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</b>
                          {" dalle "}
                          <b>{nextSlotResult.slot.slotStart?.slice(0, 5)}</b>
                          {" – "}
                          <span className="ag-nextslot__avail">{nextSlotResult.slot.availableMin} min liberi</span>
                        </span>
                        {/* FIX B2: "Ancora →" ora funziona perché dateChangedBySearchRef
                            impedisce il reset di nextSlotResult quando cambia dateISO */}
                        <button type="button" className="ag-btn ag-btn--ghost ag-nextslot__more" disabled={nextSlotLoading} onClick={searchNextSlotAgain}>
                          Ancora →
                        </button>
                        <button
                          type="button"
                          className="ag-btn ag-btn--primary ag-nextslot__more"
                          onClick={() => {
                            const { date: slotDate, slotStart } = nextSlotResult.slot;
                            setModalMode("create");
                            setSelected({ startTime: `${slotDate}T${slotStart?.slice(0, 5)}` });
                            setModalOpen(true);
                          }}
                        >
                          📅 Prenota
                        </button>
                      </>
                    ) : (
                      <span className="ag-nextslot__result-text ag-muted">{nextSlotResult.error || "Nessuno slot disponibile nei prossimi 90 giorni."}</span>
                    )}
                  </div>
                )}
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
                <div className="ag-kpi__item">
                  <div className="ag-kpi__label">Giornata</div>
                  <div className="ag-kpi__value">
                    {kpi.openMin ? (
                      kpi.occ >= 85 ? (
                        <span className="ag-day-full">Piena 🔴</span>
                      ) : kpi.occ >= 60 ? (
                        <span className="ag-day-busy">Intensa 🟡</span>
                      ) : (
                        <span className="ag-day-free">Libera 🟢</span>
                      )
                    ) : (
                      "—"
                    )}
                  </div>
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
              {successMsg && (
                <Alert variant="success" className="mt-3 mb-0">
                  {successMsg}
                </Alert>
              )}
            </Card.Body>
          </Card>

          {viewMode === "day" && (
            <div className="mt-3 d-none d-md-block">
              <TimelineDay
                dateISO={dateISO}
                data={timeline}
                bookings={bookings}
                selectedBookingId={highlightedId}
                onBookingClick={handleTimelineBookingClick}
              />
            </div>
          )}
        </Col>

        {/* RIGHT */}
        <Col lg={viewMode === "week" ? 12 : 8}>
          <Card className="ag-card h-100">
            <Card.Body className="ag-card__body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <div className="ag-title">Appuntamenti</div>
                  <div className="ag-subtitle">
                    {viewMode === "day" ? `${dateISO} · ${filtered.length}${hasStatusFilter ? ` di ${bookings.length}` : ""} risultati` : "Vista settimana"}
                  </div>
                </div>
                {viewMode === "day" && (
                  <div className="d-flex gap-2 align-items-center">
                    <Form.Control className="ag-search" placeholder="Cerca cliente, telefono, servizio…" value={q} onChange={e => setQ(e.target.value)} />
                    <Button className="ag-btn ag-btn--ghost" onClick={refresh} disabled={loading}>
                      {loading ? <Spinner size="sm" /> : "Aggiorna"}
                    </Button>
                  </div>
                )}
              </div>

              {viewMode === "day" && (
                <div className="ag-filters">
                  <button type="button" className={`ag-filter-pill pill--all ${!hasStatusFilter ? "is-active" : ""}`} onClick={clearStatusFilters}>
                    <span>Tutti</span>
                    <span className="ag-filter-count">{bookings.length}</span>
                  </button>
                  {[
                    ["PENDING", "In attesa", "pending", statusCounts.pending],
                    ["CONFIRMED", "Confermati", "confirmed", statusCounts.confirmed],
                    ["COMPLETED", "Completati", "completed", statusCounts.completed],
                    ["CANCELLED", "Cancellati", "cancelled", statusCounts.cancelled],
                  ].map(([key, label, cls, count]) => (
                    <button
                      key={key}
                      type="button"
                      className={`ag-filter-pill pill--${cls} ${statusFilter.has(key) ? "is-active" : ""}`}
                      onClick={() => toggleStatus(key)}
                    >
                      <span>{label}</span>
                      <span className="ag-filter-count">{count}</span>
                    </button>
                  ))}
                </div>
              )}

              {viewMode === "week" ? (
                <WeeklyCalendar
                  anchorDate={date}
                  onDayClick={handleWeekDayClick}
                  onBookingClick={handleWeekBookingClick}
                  onSlotClick={handleSlotClick}
                  onPrevWeek={() => setDate(d => addDays(d, -7))}
                  onNextWeek={() => setDate(d => addDays(d, 7))}
                  refreshKey={weekRefreshKey}
                />
              ) : (
                <>
                  <div className="ag-list">
                    {filtered.map(b => (
                      <div
                        key={b.bookingId}
                        className={`ag-item${highlightedId === b.bookingId ? " ag-item--highlighted" : ""}`}
                        ref={el => {
                          if (el) itemRefsMap.current.set(b.bookingId, el);
                          else itemRefsMap.current.delete(b.bookingId);
                        }}
                      >
                        <div className="ag-item__header">
                          <div className="ag-item__time">
                            <div className="ag-item__timeMain">
                              {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                            </div>
                            {/* FEATURE paddingMinutes: mostra il buffer nella card */}
                            <div className="ag-item__timeSub">
                              {Math.max(0, Math.round((new Date(b.endTime) - new Date(b.startTime)) / 60000))} min
                              {b.paddingMinutes > 0 &&
                                (() => {
                                  const realEnd = new Date(new Date(b.endTime).getTime() + b.paddingMinutes * 60000);
                                  const hh = String(realEnd.getHours()).padStart(2, "0");
                                  const mm = String(realEnd.getMinutes()).padStart(2, "0");
                                  return (
                                    <span style={{ marginLeft: 5, opacity: 0.7, fontSize: "0.72rem" }}>
                                      → finisce alle {hh}:{mm} (+{b.paddingMinutes}′)
                                    </span>
                                  );
                                })()}
                            </div>
                          </div>
                          <StatusPill status={b.status} />
                        </div>

                        <div className="ag-item__body">
                          <div className="ag-item__name">{b.customerName}</div>
                          <div className="ag-item__meta">
                            <span className="ag-muted">{b.customerPhone}</span>
                            {b.customerPhone && (
                              <button
                                className="ag-wa-btn"
                                type="button"
                                title="Apri WhatsApp"
                                onClick={e => {
                                  e.stopPropagation();
                                  openWhatsApp(b.customerPhone);
                                }}
                              >
                                <span className="ag-wa-btn__icon">💬</span>
                                <span>WhatsApp</span>
                              </button>
                            )}
                            <span className="ag-dotsep">•</span>
                            <span className="ag-muted">{b.customerEmail}</span>
                          </div>
                          <div className="ag-item__service">
                            <span className="ag-service">{b.serviceTitle || "—"}</span>
                            {b.optionName ? <span className="ag-option"> · {b.optionName}</span> : null}
                            {b.notes ? <span className="ag-notes"> · {b.notes}</span> : null}
                            {b.packageCreditId &&
                              (() => {
                                const remaining = Number.isFinite(b.sessionsRemaining) ? b.sessionsRemaining : null;
                                const total = Number.isFinite(b.sessionsTotal) ? b.sessionsTotal : null;
                                const status = b.packageStatus || "ACTIVE";
                                let variant = status === "EXPIRED" ? "expired" : remaining === 0 ? "done" : remaining === 1 ? "last" : "active";
                                return (
                                  <span className={`ag-pkg-indicator ag-pkg-indicator--${variant}`} title={remaining === 1 ? "Ultima seduta!" : ""}>
                                    📦 {remaining ?? "?"}/{total ?? "?"}
                                  </span>
                                );
                              })()}
                          </div>
                        </div>

                        {b.consentRequired && (
                          <div className="ag-item__consent">
                            {b.consentSigned ? (
                              <span className="agenda-consent-badge agenda-consent-badge--signed">
                                ✅ Consenso firmato
                                {b.consentSignedAt && (
                                  <span style={{ marginLeft: 4, fontWeight: 400, opacity: 0.8 }}>
                                    il {new Date(b.consentSignedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <>
                                <span className="agenda-consent-badge agenda-consent-badge--pending">
                                  ✍️ Consenso da firmare
                                </span>
                                {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                                  <button
                                    type="button"
                                    className="agenda-consent-btn"
                                    onClick={() => signConsent(b)}
                                  >
                                    Segna consenso firmato
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        <div className="ag-item__actions">
                          {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                            <Button className="ag-btn ag-btn--soft" size="sm" onClick={() => openEdit(b)}>
                              Modifica
                            </Button>
                          )}
                          {(b.status === "PENDING" || b.status === "PENDING_PAYMENT") && (
                            <Button className="ag-btn ag-btn--primary" size="sm" onClick={() => changeStatus(b.bookingId, "CONFIRMED")}>
                              Conferma
                            </Button>
                          )}
                          {b.status === "CONFIRMED" && (
                            <>
                              <Button className="ag-btn ag-btn--ok" size="sm" onClick={() => changeStatus(b.bookingId, "COMPLETED")}>
                                Completa
                              </Button>
                              <Button className="ag-btn ag-btn--ghost" size="sm" onClick={() => changeStatus(b.bookingId, "NO_SHOW")}>
                                Non presentata
                              </Button>
                            </>
                          )}
                          {(b.status === "PENDING" || b.status === "PENDING_PAYMENT" || b.status === "CONFIRMED") && (
                            <Button className="ag-btn ag-btn--ghost" size="sm" onClick={() => askCancel(b)}>
                              Annulla
                            </Button>
                          )}
                          {b.stripeSessionId && (b.status === "CONFIRMED" || b.status === "CANCELLED") && (
                            <Button className="ag-btn ag-btn--danger" size="sm" onClick={() => handleRefund(b)}>
                              Rimborsa
                            </Button>
                          )}
                          <Button className="ag-btn ag-btn--danger" size="sm" onClick={() => askDelete(b)}>
                            Elimina
                          </Button>
                          <Button
                            className="ag-btn ag-btn--soft"
                            size="sm"
                            onClick={() => setOpenSalePanel(openSalePanel === b.bookingId ? null : b.bookingId)}
                          >
                            🛍️ Prodotto
                          </Button>
                        </div>

                        {b.status !== "CANCELLED" &&
                          b.status !== "COMPLETED" &&
                          (() => {
                            const maxPad = paddingMaxMap.get(b.bookingId) ?? 120;
                            const currentPad = b.paddingMinutes ?? 0;
                            const isEditing = paddingEditing === b.bookingId;
                            const isSaving = paddingSaving === b.bookingId;

                            return (
                              <div className="ag-padding-row">
                                {!isEditing ? (
                                  <>
                                    <span className="ag-padding-row__label">{currentPad > 0 ? `⏱ +${currentPad}′ buffer` : "⏱ Nessun buffer"}</span>
                                    {maxPad > 0 ? (
                                      <button
                                        type="button"
                                        className="ag-padding-row__btn"
                                        onClick={() => {
                                          setPaddingDraft(b.paddingMinutes ?? 0);
                                          setPaddingEditing(b.bookingId);
                                        }}
                                      >
                                        {currentPad > 0 ? "Modifica" : "+ Buffer"}
                                      </button>
                                    ) : (
                                      <span className="ag-padding-row__blocked">Slot pieno — nessun buffer possibile</span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="ag-padding-row__label">Buffer (max {maxPad}′)</span>
                                    <div className="ag-padding-row__controls">
                                      {[0, 15, 30, 45]
                                        .filter(p => p <= maxPad)
                                        .map(p => (
                                          <button
                                            key={p}
                                            type="button"
                                            disabled={isSaving}
                                            className={`ag-nextslot__chip ${paddingDraft === p ? "is-active" : ""}`}
                                            onClick={() => setPaddingDraft(p)}
                                          >
                                            {p === 0 ? "Nessuno" : `+${p}′`}
                                          </button>
                                        ))}
                                      <button
                                        type="button"
                                        className="ag-padding-row__step"
                                        disabled={paddingDraft <= 0 || isSaving}
                                        onClick={() => setPaddingDraft(v => Math.max(0, v - 5))}
                                      >
                                        −
                                      </button>
                                      <span className="ag-padding-row__val">{paddingDraft}′</span>
                                      <button
                                        type="button"
                                        className="ag-padding-row__step"
                                        disabled={paddingDraft >= maxPad || isSaving}
                                        onClick={() => setPaddingDraft(v => Math.min(maxPad, v + 5))}
                                      >
                                        +
                                      </button>
                                      <button
                                        type="button"
                                        className="ag-padding-row__btn"
                                        disabled={isSaving}
                                        onClick={() => savePadding(b.bookingId, paddingDraft)}
                                        style={{ marginLeft: 4 }}
                                      >
                                        {isSaving ? <Spinner size="sm" animation="border" /> : "Conferma"}
                                      </button>
                                      <button
                                        type="button"
                                        className="ag-padding-row__cancel"
                                        disabled={isSaving}
                                        onClick={() => setPaddingEditing(null)}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}

                        {openSalePanel === b.bookingId && <BookingSalePanel bookingId={b.bookingId} onClose={() => setOpenSalePanel(null)} />}
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
                  <div className="ag-footnote mt-2">Tip: "Modifica" apre la scheda completa. Per i walk-in puoi creare velocemente senza email.</div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {confirmModal && (
        <div className="ag-confirm-overlay" onClick={() => setConfirmModal(null)}>
          <div className="ag-confirm-box" onClick={e => e.stopPropagation()}>
            <div className="ag-confirm-icon">{confirmModal.type === "delete" ? "🗑️" : "✕"}</div>
            <div className="ag-confirm-title">{confirmModal.type === "delete" ? "Elimina prenotazione" : "Annulla prenotazione"}</div>
            <div className="ag-confirm-body">
              {confirmModal.type === "delete" ? (
                <>
                  Vuoi eliminare definitivamente l&apos;appuntamento di <b>{confirmModal.customerName}</b>? Questa azione è irreversibile.
                </>
              ) : (
                <>
                  Vuoi annullare l&apos;appuntamento di <b>{confirmModal.customerName}</b>? Rimarrà nello storico come &quot;Cancellato&quot;.
                </>
              )}
            </div>
            {confirmModal.type === "delete" && confirmModal.stripeSessionId && (
              <div className="ag-confirm-warning">⚠️ Questa prenotazione è stata pagata online. Eliminandola non verrà emesso alcun rimborso automatico.</div>
            )}
            {confirmModal.type === "delete" && confirmModal.booking?.status === "COMPLETED" && confirmModal.booking?.packageCreditId && (
              <div className="ag-confirm-warning">
                ⚠️ Questa prenotazione è COMPLETATA e collegata a un pacchetto. La seduta consumata NON verrà ripristinata automaticamente.
              </div>
            )}
            <div className="ag-confirm-actions">
              <button className="ag-btn ag-btn--ghost" onClick={() => setConfirmModal(null)}>
                Indietro
              </button>
              <button
                className={`ag-btn ${confirmModal.type === "delete" ? "ag-btn--danger" : "ag-btn--ghost"}`}
                onClick={() => {
                  if (confirmModal.type === "delete") removeBooking(confirmModal.booking);
                  else changeStatus(confirmModal.bookingId, "CANCELLED");
                  setConfirmModal(null);
                }}
              >
                {confirmModal.type === "delete" ? "Elimina" : "Annulla appuntamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="ag-snackbar">
          <span className="ag-snackbar__text">
            Appuntamento di <b>{pendingDelete.booking.customerName}</b> eliminato
          </span>
          <button type="button" className="ag-snackbar__undo" onClick={undoDelete}>
            Annulla
          </button>
          <span className="ag-snackbar__countdown">{deleteCountdown}</span>
        </div>
      )}

      <BookingModal
        show={modalOpen}
        onHide={() => setModalOpen(false)}
        mode={modalMode}
        initial={modalMode === "edit" ? selected : selected?.startTime ? selected : null}
        services={services}
        onSubmit={submitModal}
      />
    </Container>
  );
}
