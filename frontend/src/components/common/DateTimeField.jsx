import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./DateTimeField.css";

const MOBILE_MAX_PX = 575;

const pad2 = n => String(n).padStart(2, "0");

export function toISODateLocal(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIncoming(value, mode) {
  if (value == null || value === "") return { dateStr: null, timeStr: null };
  if (mode === "date") {
    const s = String(value).slice(0, 10);
    return { dateStr: /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null, timeStr: null };
  }
  if (mode === "time") {
    const raw = String(value).trim();
    const m = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (m) return { dateStr: null, timeStr: `${m[1]}:${m[2]}` };
    return { dateStr: null, timeStr: null };
  }
  const raw = String(value);
  const local = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (local) return { dateStr: local[1], timeStr: local[2] };
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return { dateStr: toISODateLocal(d), timeStr: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` };
  }
  return { dateStr: null, timeStr: null };
}

function emitOutgoing(dateStr, timeStr, mode) {
  if (mode === "date") return dateStr || "";
  if (mode === "time") return timeStr || "";
  if (!dateStr || !timeStr) return "";
  return `${dateStr}T${timeStr}`;
}

function makeMinDateStr(minDate) {
  if (minDate == null) return null;
  if (minDate instanceof Date) return toISODateLocal(minDate);
  if (typeof minDate === "string") return minDate.slice(0, 10);
  return null;
}

function generateHalfHourSlots() {
  const out = [];
  let t = 8 * 60;
  const end = 19 * 60 + 30;
  while (t <= end) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    out.push(`${pad2(h)}:${pad2(m)}`);
    t += 30;
  }
  return out;
}

const TIME_SLOTS = generateHalfHourSlots();

function CalendarIcon() {
  return (
    <svg className="dtf-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @typedef {{ date: string, count: number }} BusyDateEntry
 */

export default function DateTimeField({
  label,
  value,
  onChange,
  mode = "datetime",
  minDate,
  disabledDates = [],
  busyDates = [],
  placeholder = "Seleziona data…",
  disabled = false,
  error = null,
  variant = "field",
  className = "",
}) {
  const id = useId();
  const rootRef = useRef(null);
  const portalRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const parsed = useMemo(() => parseIncoming(value, mode), [value, mode]);
  const minDateStr = useMemo(() => makeMinDateStr(minDate), [minDate]);
  const disabledSet = useMemo(() => new Set((disabledDates || []).map(d => String(d).slice(0, 10))), [disabledDates]);
  const busyMap = useMemo(() => {
    const m = new Map();
    (busyDates || []).forEach(b => {
      if (b?.date) m.set(String(b.date).slice(0, 10), Number(b.count) || 0);
    });
    return m;
  }, [busyDates]);

  const [draftDate, setDraftDate] = useState(null);
  const [draftTime, setDraftTime] = useState(null);
  const [pendingTime, setPendingTime] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const draftDateRef = useRef(null);
  useEffect(() => {
    draftDateRef.current = draftDate;
  }, [draftDate]);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const { dateStr, timeStr } = parsed;
    setDraftDate(dateStr);
    setDraftTime(timeStr);
    setPendingTime(null);
    if (dateStr) {
      const [y, mo, d] = dateStr.split("-").map(Number);
      setViewYear(y);
      setViewMonth(mo - 1);
    }
  }, [parsed.dateStr, parsed.timeStr, value, mode]);

  const syncViewToDate = useCallback(dStr => {
    if (!dStr) return;
    const [y, mo] = dStr.split("-").map(Number);
    setViewYear(y);
    setViewMonth(mo - 1);
  }, []);

  const close = useCallback(() => {
    setPendingTime(null);
    if (isMobile && variant === "field") {
      setIsClosing(true); // animazione slideDownSheet → onAnimationEnd chiude
    } else {
      setOpen(false);
    }
  }, [isMobile, variant]);

  // Resetta isClosing quando il sheet viene riaperto
  useEffect(() => {
    if (open) setIsClosing(false);
  }, [open]);

  useEffect(() => {
    if (variant === "inline") return;
    if (!open) return;
    const onDoc = e => {
      if (rootRef.current?.contains(e.target)) return;
      if (portalRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open, close, variant]);

  useEffect(() => {
    if (variant === "inline") return;
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, variant]);

  useEffect(() => {
    if (variant === "inline") return;
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile, variant]);

  const displayDateLabel = useMemo(() => {
    if (mode === "time") return "";
    const ds = parsed.dateStr;
    if (!ds) return "";
    const d = new Date(`${ds}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [mode, parsed.dateStr]);

  const displayTimeLabel = useMemo(() => {
    if (mode === "date") return "";
    if (!parsed.timeStr) return "";
    return parsed.timeStr;
  }, [mode, parsed.timeStr]);

  const prevMonth = () => {
    if (mode === "time") return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (mode === "time") return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDOW = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = (firstDOW + 6) % 7;
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const isToday = useCallback(
    day => {
      const dt = new Date(viewYear, viewMonth, day);
      return dt.toDateString() === new Date().toDateString();
    },
    [viewMonth, viewYear],
  );

  const isPast = useCallback(
    day => {
      const dt = new Date(viewYear, viewMonth, day);
      dt.setHours(0, 0, 0, 0);
      if (minDateStr) {
        const min = new Date(minDateStr + "T00:00:00");
        if (dt < min) return true;
      }
      return false;
    },
    [minDateStr, viewMonth, viewYear],
  );

  const isDisabledDay = useCallback(
    day => {
      const iso = toISODateLocal(new Date(viewYear, viewMonth, day));
      return disabledSet.has(iso);
    },
    [disabledSet, viewMonth, viewYear],
  );

  const isSelectedDay = useCallback(
    day => {
      const sel = mode === "datetime" ? draftDate || parsed.dateStr : parsed.dateStr || draftDate;
      if (!sel) return false;
      const iso = toISODateLocal(new Date(viewYear, viewMonth, day));
      return sel === iso;
    },
    [draftDate, mode, parsed.dateStr, viewMonth, viewYear],
  );

  const applyDate = useCallback(
    iso => {
      setDraftDate(iso);
      draftDateRef.current = iso;
      syncViewToDate(iso);
      if (mode === "date") {
        onChange?.(emitOutgoing(iso, null, mode));
        close();
      }
    },
    [close, mode, onChange, syncViewToDate],
  );

  const handleDayClick = day => {
    if (!day || isPast(day) || isDisabledDay(day)) return;
    const iso = toISODateLocal(new Date(viewYear, viewMonth, day));
    applyDate(iso);
  };

  const commitDateTime = useCallback(
    (dateStr, timeStr) => {
      onChange?.(emitOutgoing(dateStr, timeStr, mode));
      close();
    },
    [close, mode, onChange],
  );

  const handleTimeClick = slot => {
    if (mode === "time") {
      setDraftTime(slot);
      if (!isMobile) {
        onChange?.(emitOutgoing(null, slot, mode));
        close();
      } else {
        setPendingTime(slot);
      }
      return;
    }
    setDraftTime(slot);
    if (!isMobile) {
      const dStr = draftDateRef.current || parsed.dateStr;
      if (dStr) commitDateTime(dStr, slot);
    } else {
      setPendingTime(slot);
    }
  };

  const handleMobileConfirm = () => {
    if (mode === "datetime") {
      const dStr = draftDate || parsed.dateStr;
      const tStr = pendingTime ?? draftTime;
      if (dStr && tStr) commitDateTime(dStr, tStr);
    } else if (mode === "time") {
      const tStr = pendingTime ?? draftTime ?? parsed.timeStr;
      if (tStr) onChange?.(emitOutgoing(null, tStr, mode));
      close();
    }
  };

  const showTimeSection =
    mode === "time" || (mode === "datetime" && (draftDate || parsed.dateStr));

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const DOW_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  const panelInner = (
    <div className="dtf-panel-inner">
      {mode !== "time" && (
        <div className="dtf-cal-wrap" key={`${viewYear}-${viewMonth}`}>
          <div className="dtf-header">
            <button type="button" className="dtf-nav-btn" onClick={prevMonth} aria-label="Mese precedente">
              ‹
            </button>
            <span className="dtf-month-label">{monthName}</span>
            <button type="button" className="dtf-nav-btn" onClick={nextMonth} aria-label="Mese successivo">
              ›
            </button>
          </div>
          <div className="dtf-grid">
            {DOW_LABELS.map(l => (
              <div key={l} className="dtf-dow">
                {l}
              </div>
            ))}
            {cells.map((d, i) => {
              const classes = ["dtf-day"];
              if (d === null) classes.push("dtf-day--empty");
              if (d && isSelectedDay(d)) classes.push("dtf-day--selected");
              if (d && isToday(d)) classes.push("dtf-day--today");
              if (d && isPast(d)) classes.push("dtf-day--past");
              if (d && isDisabledDay(d)) classes.push("dtf-day--blocked");
              const iso = d ? toISODateLocal(new Date(viewYear, viewMonth, d)) : null;
              const busy = iso ? busyMap.get(iso) : null;
              return (
                <div
                  key={i}
                  className={classes.join(" ")}
                  role={d ? "button" : undefined}
                  tabIndex={d && !isPast(d) && !isDisabledDay(d) ? 0 : undefined}
                  title={d && isDisabledDay(d) ? "Chiuso" : undefined}
                  onClick={() => handleDayClick(d)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleDayClick(d);
                    }
                  }}
                >
                  {d && (
                    <>
                      <span className="dtf-day-num">{d}</span>
                      {isDisabledDay(d) && <span className="dtf-day-closed-label">Chiuso</span>}
                      {busy != null && busy > 0 && <span className="dtf-busy-badge">{busy > 99 ? "99+" : busy}</span>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showTimeSection && (
        <div className="dtf-time-section">
          <div className="dtf-time-title">{mode === "datetime" ? "Orario" : "Seleziona orario"}</div>
          <div className="dtf-slots">
            {TIME_SLOTS.map(slot => {
              const active =
                mode === "time"
                  ? (pendingTime ?? draftTime ?? parsed.timeStr) === slot
                  : (pendingTime ?? draftTime ?? parsed.timeStr) === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  className={`dtf-slot ${active ? "is-selected" : ""}`}
                  onClick={() => handleTimeClick(slot)}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );

  const dropdown =
    variant === "field" && open && !isMobile ? (
      <div className="dtf-dropdown">{panelInner}</div>
    ) : null;

  const portal =
    variant === "field" && open && isMobile
      ? createPortal(
          <>
            <div className="dtf-backdrop" onClick={close} aria-hidden />
            <div
              ref={portalRef}
              className={`dtf-sheet${isClosing ? " dtf-sheet--closing" : ""}`}
              role="dialog"
              aria-modal="true"
              onAnimationEnd={e => {
                if (e.animationName === "slideDownSheet") {
                  setIsClosing(false);
                  setOpen(false);
                }
              }}
            >
              <div className="dtf-handle" />
              {label ? <div className="dtf-sheet-title">{label}</div> : null}
              {panelInner}
              {isMobile && pendingTime && (mode === "time" || (mode === "datetime" && (draftDate || parsed.dateStr))) ? (
                <div className="dtf-mobile-actions">
                  <button type="button" className="dtf-btn-confirm" onClick={handleMobileConfirm}>
                    Seleziona
                  </button>
                </div>
              ) : null}
            </div>
          </>,
          document.body,
        )
      : null;

  const trigger = (
    <button
      id={`${id}-trigger`}
      type="button"
      className={`dtf-trigger ${error ? "dtf-trigger--error" : ""}`}
      disabled={disabled}
      onClick={() => !disabled && setOpen(o => !o)}
      aria-expanded={open}
      aria-haspopup="dialog"
    >
      <CalendarIcon />
      <span className="dtf-trigger-mid">
        {mode !== "time" && (
          <span className={!displayDateLabel ? "dtf-placeholder" : ""}>{displayDateLabel || placeholder}</span>
        )}
        {mode === "datetime" && <span className="dtf-sep">|</span>}
        {mode !== "date" && (
          <span className={!displayTimeLabel ? "dtf-placeholder" : ""}>
            {displayTimeLabel || "—:—"}
          </span>
        )}
      </span>
    </button>
  );

  if (variant === "inline") {
    return <div className={`dtf dtf--inline ${className}`.trim()}>{panelInner}</div>;
  }

  return (
    <div ref={rootRef} className={`dtf ${className}`.trim()}>
      {label ? (
        <label className="dtf-label" htmlFor={`${id}-trigger`}>
          {label}
        </label>
      ) : null}
      {trigger}
      {dropdown}
      {portal}
      {error ? <div className="dtf-error">{error}</div> : null}
    </div>
  );
}
