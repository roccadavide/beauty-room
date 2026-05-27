import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DateTimeField from "../../components/common/DateTimeField";
import RangeCalendar from "../../components/common/RangeCalendar";
import TimePicker from "../../components/common/TimePicker";
import {
  createClosure,
  deleteClosure,
  getClosuresRange,
  previewClosureConflicts,
  updateClosure,
} from "../../api/modules/adminAgenda.api";
import useKeyboardAwarePanel from "../../hooks/useKeyboardAwarePanel";
import "./ClosuresDrawer.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const REASON_PRESETS = ["Ferie", "Malattia", "Formazione", "Pausa", "Impegno personale", "Festività"];
const REASON_MAX = 150;
const PREVIEW_DEBOUNCE_MS = 400;
const DEFAULT_CLOSING_TIME = "19:00";

const pad2 = n => String(n).padStart(2, "0");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const _MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const _WEEKDAYS_IT = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

const fmtDateLong = iso => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${_WEEKDAYS_IT[dt.getDay()]} ${d} ${_MONTHS_IT[m - 1]}`;
};

const fmtDateTime = iso => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)} alle ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
};

const ceilToFiveMin = (h, m) => {
  let total = h * 60 + m;
  total = Math.ceil(total / 5) * 5;
  if (total >= 24 * 60) total = 24 * 60 - 5;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};

const isHHMMValid = s => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);

const sameYmd = (a, b) => !!a && !!b && a === b;

// ── Component ─────────────────────────────────────────────────────────────────
export default function ClosuresDrawer({
  isOpen,
  onClose,
  selectedDate,        // ISO "YYYY-MM-DD" of agenda's currently-viewed day
  dayOpenRanges,       // [{ start: "HH:mm", end: "HH:mm" }] for selectedDate
  onClosuresChanged,   // () => void — agenda refresh callback
}) {
  const today = useMemo(() => todayISO(), []);

  // ── Form state ────────────────────────────────────────────────────────────
  // Both dates start EMPTY: the range calendar's first-tap rule needs a
  // clean slate, otherwise a pre-filled "today" would always trigger
  // "extend end" on the user's next tap.
  const [mode, setMode] = useState("fullDay"); // "fullDay" | "window"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ── List state ────────────────────────────────────────────────────────────
  const [closures, setClosures] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ── Conflict preview state ────────────────────────────────────────────────
  const [conflictPreview, setConflictPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTimerRef = useRef(null);
  const previewAbortRef = useRef(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const formAnchorRef = useRef(null);
  const panelRef = useRef(null);

  // Lift the panel above the iOS virtual keyboard while a text input inside is focused.
  useKeyboardAwarePanel(panelRef, isOpen);

  // ── Reset form when drawer opens ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setMode("fullDay");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setReason("");
    setEditingId(null);
    setError(null);
    setConflictPreview(null);
  }, [isOpen]);

  // ── Body scroll lock (mirrors NewAppointmentDrawer) ───────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [isOpen]);

  // ── ESC closes ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = e => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── Fetch closures (12-month window — covers historical + upcoming) ───────
  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const from = new Date();
      from.setMonth(from.getMonth() - 6);
      const to = new Date();
      to.setMonth(to.getMonth() + 12);
      const fromISO = `${from.getFullYear()}-${pad2(from.getMonth() + 1)}-${pad2(from.getDate())}`;
      const toISO = `${to.getFullYear()}-${pad2(to.getMonth() + 1)}-${pad2(to.getDate())}`;
      const data = await getClosuresRange(fromISO, toISO);
      setClosures(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) refreshList();
  }, [isOpen, refreshList]);

  // ── Conflict preview (debounced) ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    clearTimeout(previewTimerRef.current);

    const canPreview = !!startDate
      && (mode === "fullDay"
          || (isHHMMValid(startTime) && isHHMMValid(endTime) && startTime < endTime));
    if (!canPreview) {
      setConflictPreview(null);
      setPreviewLoading(false);
      return;
    }

    previewTimerRef.current = setTimeout(async () => {
      const myToken = ++previewAbortRef.current;
      setPreviewLoading(true);
      try {
        const payload = buildPayload({ mode, startDate, endDate, startTime, endTime, reason: reason || "preview" });
        const result = await previewClosureConflicts(payload);
        if (myToken === previewAbortRef.current) setConflictPreview(result);
      } catch {
        if (myToken === previewAbortRef.current) setConflictPreview(null);
      } finally {
        if (myToken === previewAbortRef.current) setPreviewLoading(false);
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(previewTimerRef.current);
  }, [isOpen, mode, startDate, endDate, startTime, endTime, reason]);

  // ── Derived: split upcoming vs past ───────────────────────────────────────
  const { upcomingClosures, pastClosures } = useMemo(() => {
    const up = [];
    const past = [];
    closures.forEach(c => {
      const end = c.endDate || c.date || c.startDate;
      if (end && end >= today) up.push(c);
      else past.push(c);
    });
    const cmpAsc = (a, b) => {
      const aKey = `${a.startDate || a.date}T${a.startTime || "00:00"}`;
      const bKey = `${b.startDate || b.date}T${b.startTime || "00:00"}`;
      return aKey.localeCompare(bKey);
    };
    up.sort(cmpAsc);
    past.sort((a, b) => -cmpAsc(a, b));
    return { upcomingClosures: up, pastClosures: past };
  }, [closures, today]);

  // ── "Da ora a fine giornata" quick action ─────────────────────────────────
  const closingTimeForToday = useMemo(() => {
    if (!Array.isArray(dayOpenRanges) || dayOpenRanges.length === 0) return DEFAULT_CLOSING_TIME;
    const lastEnd = dayOpenRanges[dayOpenRanges.length - 1]?.end;
    return isHHMMValid(lastEnd) ? lastEnd : DEFAULT_CLOSING_TIME;
  }, [dayOpenRanges]);

  const canApplyNowToEnd = mode === "window" && sameYmd(startDate, today);

  const applyNowToEndOfDay = () => {
    if (!canApplyNowToEnd) return;
    const now = new Date();
    const start = ceilToFiveMin(now.getHours(), now.getMinutes());
    if (start >= closingTimeForToday) {
      setError("Sei già oltre l'orario di chiusura di oggi.");
      return;
    }
    setStartTime(start);
    setEndTime(closingTimeForToday);
    setError(null);
  };

  // ── Load closure into form for editing ────────────────────────────────────
  const loadIntoForm = c => {
    if (!c) return;
    const sd = c.startDate || c.date;
    const ed = c.endDate || c.date || c.startDate;
    setMode(c.fullDay ? "fullDay" : "window");
    setStartDate(sd);
    setEndDate(ed && ed !== sd ? ed : "");
    setStartTime(c.startTime ? String(c.startTime).slice(0, 5) : "");
    setEndTime(c.endTime ? String(c.endTime).slice(0, 5) : "");
    setReason(c.reason || "");
    setEditingId(c.id);
    setError(null);
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const resetForm = () => {
    setMode("fullDay");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setReason("");
    setEditingId(null);
    setError(null);
  };

  // ── Save / Delete ─────────────────────────────────────────────────────────
  const save = async () => {
    setError(null);

    if (!startDate) return setError("La data di inizio è obbligatoria.");
    if (mode === "window") {
      if (!isHHMMValid(startTime) || !isHHMMValid(endTime)) {
        return setError("Specifica orario di inizio e fine.");
      }
      if (!(startTime < endTime)) {
        return setError("L'orario di inizio deve precedere quello di fine.");
      }
      if (endDate && endDate !== startDate) {
        return setError("Una chiusura su più giorni deve essere a giornata intera.");
      }
    }
    if (!reason.trim()) return setError("Il motivo è obbligatorio.");
    if (reason.length > REASON_MAX) return setError(`Il motivo può essere lungo al massimo ${REASON_MAX} caratteri.`);

    const payload = buildPayload({ mode, startDate, endDate, startTime, endTime, reason: reason.trim() });
    setSaving(true);
    try {
      if (editingId) await updateClosure(editingId, payload);
      else await createClosure(payload);
      await refreshList();
      onClosuresChanged?.();
      resetForm();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async id => {
    if (!id) return;
    const ok = window.confirm("Eliminare questa chiusura?");
    if (!ok) return;
    try {
      await deleteClosure(id);
      if (editingId === id) resetForm();
      await refreshList();
      onClosuresChanged?.();
    } catch (e) {
      setError(e.message);
    }
  };

  const canSave = !!startDate && !!reason.trim()
    && (mode === "fullDay"
        || (isHHMMValid(startTime) && isHHMMValid(endTime) && startTime < endTime));

  // ── Render ────────────────────────────────────────────────────────────────
  // Portale su document.body: position:fixed dev'essere ancorato al viewport,
  // non al containing block creato da PageTransition (will-change/filter sulla
  // motion.div). Stesso pattern di PromoDetailDrawer.
  return createPortal(
    <>
      <div className={`cld-backdrop${isOpen ? " is-open" : ""}`} onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        className={`cld-drawer${isOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Chiusure"
        data-lenis-prevent
      >
        <header className="cld-header">
          <h2 className="cld-title">🔒 Chiusure</h2>
          <button type="button" className="cld-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </header>

        <div className="cld-content" onWheel={e => e.stopPropagation()}>
          <section className="cld-form" ref={formAnchorRef}>
            <div className="cld-form-title">
              {editingId ? "✏️ Modifica chiusura" : "➕ Nuova chiusura"}
            </div>

            <div className="cld-segmented" role="tablist" aria-label="Tipo chiusura">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "fullDay"}
                className={`cld-seg${mode === "fullDay" ? " is-active" : ""}`}
                onClick={() => setMode("fullDay")}
              >
                Giornata intera
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "window"}
                className={`cld-seg${mode === "window" ? " is-active" : ""}`}
                onClick={() => {
                  setMode("window");
                  setEndDate("");
                }}
              >
                Fascia oraria
              </button>
            </div>

            {mode === "fullDay" ? (
              <div className="cld-cal-section">
                <RangeCalendar
                  startDate={startDate}
                  endDate={endDate || startDate}
                  onChange={({ startDate: sd, endDate: ed }) => {
                    setStartDate(sd);
                    setEndDate(ed);
                  }}
                  minDate={today}
                />
                <div className="cld-cal-summary">
                  {!startDate ? (
                    <span className="cld-cal-hint">
                      Tocca una data per iniziare. Tocca un giorno successivo per estendere l'intervallo.
                    </span>
                  ) : endDate && endDate !== startDate ? (
                    <span>
                      Dal <strong>{fmtDateLong(startDate)}</strong> al <strong>{fmtDateLong(endDate)}</strong>
                    </span>
                  ) : (
                    <span>
                      Singolo giorno · <strong>{fmtDateLong(startDate)}</strong>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="cld-field">
                  <label className="cld-label">Data</label>
                  <DateTimeField
                    mode="date"
                    value={startDate}
                    onChange={v => { setStartDate(v); setEndDate(""); }}
                    placeholder="Seleziona data"
                    minDate={today}
                  />
                </div>
                <div className="cld-times">
                  <TimePicker label="Dalle" value={startTime} onChange={setStartTime} minuteStep={5} />
                  <TimePicker label="Alle"  value={endTime}   onChange={setEndTime}   minuteStep={5} />
                </div>
                {canApplyNowToEnd && (
                  <button type="button" className="cld-quick" onClick={applyNowToEndOfDay}>
                    🕓 Da ora a fine giornata ({closingTimeForToday})
                  </button>
                )}
              </>
            )}

            <div className="cld-field">
              <label className="cld-label" htmlFor="cld-reason">Motivo</label>
              <input
                id="cld-reason"
                type="text"
                className="cld-input"
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={REASON_MAX}
                placeholder="Ferie, formazione, impegno personale…"
              />
              <small className="cld-hint">Visibile solo a te, non ai clienti.</small>
            </div>

            <div className="cld-chips" role="group" aria-label="Motivi rapidi">
              {REASON_PRESETS.map(p => (
                <button
                  key={p}
                  type="button"
                  className={`cld-chip${reason === p ? " is-selected" : ""}`}
                  onClick={() => setReason(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            {previewLoading && (
              <div className="cld-preview cld-preview--loading">Verifica conflitti…</div>
            )}
            {!previewLoading && conflictPreview && conflictPreview.overlappingBookingsCount > 0 && (
              <details className="cld-preview cld-preview--warn">
                <summary>
                  ⚠️ {conflictPreview.overlappingBookingsCount} appuntament{conflictPreview.overlappingBookingsCount === 1 ? "o" : "i"} già prenotat{conflictPreview.overlappingBookingsCount === 1 ? "o" : "i"} in questo periodo
                </summary>
                <ul className="cld-preview__list">
                  {conflictPreview.overlappingBookings.map(b => (
                    <li key={b.bookingId}>
                      <span className="cld-preview__when">{fmtDateTime(b.startTime)}</span>
                      <span className="cld-preview__dot"> · </span>
                      <span className="cld-preview__name">{b.customerName || "—"}</span>
                    </li>
                  ))}
                </ul>
                <small className="cld-hint">I clienti non vengono cancellati automaticamente: contattali tu.</small>
              </details>
            )}

            {error && <div className="cld-error">{error}</div>}

            <div className="cld-actions">
              {editingId && (
                <button
                  type="button"
                  className="cld-btn cld-btn--ghost"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Annulla modifica
                </button>
              )}
              <button
                type="button"
                className="cld-btn cld-btn--primary"
                onClick={save}
                disabled={saving || !canSave}
              >
                {saving ? "…" : editingId ? "Aggiorna chiusura" : "Salva chiusura"}
              </button>
            </div>
          </section>

          <section className="cld-list">
            <div className="cld-list-title">
              Chiusure programmate
              <span className="cld-list-count">{upcomingClosures.length}</span>
            </div>

            {loadingList ? (
              <div className="cld-empty">Caricamento…</div>
            ) : upcomingClosures.length === 0 ? (
              <div className="cld-empty">Nessuna chiusura programmata. ✦</div>
            ) : (
              <ul className="cld-cards">
                {upcomingClosures.map(c => (
                  <ClosureCard
                    key={c.id}
                    c={c}
                    isEditing={c.id === editingId}
                    onEdit={() => loadIntoForm(c)}
                    onDelete={() => remove(c.id)}
                  />
                ))}
              </ul>
            )}

            {pastClosures.length > 0 && (
              <div className="cld-history">
                <button
                  type="button"
                  className="cld-history-toggle"
                  onClick={() => setShowHistory(s => !s)}
                >
                  {showHistory ? "▾" : "▸"} Storico ({pastClosures.length})
                </button>
                {showHistory && (
                  <ul className="cld-cards cld-cards--past">
                    {pastClosures.map(c => (
                      <ClosureCard
                        key={c.id}
                        c={c}
                        isEditing={c.id === editingId}
                        onEdit={() => loadIntoForm(c)}
                        onDelete={() => remove(c.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── ClosureCard ──────────────────────────────────────────────────────────────
function ClosureCard({ c, isEditing, onEdit, onDelete }) {
  const sd = c.startDate || c.date;
  const ed = c.endDate || c.date || c.startDate;
  const isRange = !!ed && ed !== sd;

  const dateLabel = isRange
    ? `${fmtDateLong(sd)} → ${fmtDateLong(ed)}`
    : fmtDateLong(sd);

  const timeLabel = c.fullDay
    ? "Tutto il giorno"
    : `${String(c.startTime || "").slice(0, 5)} – ${String(c.endTime || "").slice(0, 5)}`;

  return (
    <li className={`cld-card${isEditing ? " is-editing" : ""}`}>
      <button type="button" className="cld-card__main" onClick={onEdit} aria-label="Modifica chiusura">
        <div className="cld-card__date">{dateLabel}</div>
        <div className="cld-card__meta">
          <span className="cld-card__time">{timeLabel}</span>
          <span className="cld-card__dot"> · </span>
          <span className="cld-card__reason">{c.reason}</span>
        </div>
      </button>
      <button
        type="button"
        className="cld-card__delete"
        onClick={onDelete}
        aria-label="Elimina chiusura"
        title="Elimina"
      >
        🗑
      </button>
    </li>
  );
}

// ── Payload helper ────────────────────────────────────────────────────────────
function buildPayload({ mode, startDate, endDate, startTime, endTime, reason }) {
  const sd = startDate;
  const ed = endDate && endDate !== startDate ? endDate : startDate;
  if (mode === "fullDay") {
    return {
      startDate: sd,
      endDate: ed,
      startTime: null,
      endTime: null,
      reason,
    };
  }
  return {
    startDate: sd,
    endDate: sd, // window mode is always single-day per service-side validation
    startTime: isHHMMValid(startTime) ? `${startTime}:00` : null,
    endTime:   isHHMMValid(endTime)   ? `${endTime}:00`   : null,
    reason,
  };
}
