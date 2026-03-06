import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import { getBookingsRange } from "../../api/modules/adminAgenda.api";

const pad2 = n => String(n).padStart(2, "0");
const toISODate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const DOW_IT = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
const MONTH_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const getWeekStart = date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const GRID_START_HOUR = 8;
const GRID_END_HOUR = 22;
const HOUR_HEIGHT = 60;
const GRID_START_MIN = GRID_START_HOUR * 60;

export default function WeeklyCalendar({ anchorDate, onDayClick, onBookingClick, onSlotClick, onPrevWeek, onNextWeek, refreshKey = 0 }) {
  const gridRef = useRef(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const weekStart = useMemo(() => getWeekStart(anchorDate), [anchorDate]);

  const weekDays = useMemo(() => {
    const days = [];
    const d = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      days.push({ date: new Date(d), iso: toISODate(d) });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [weekStart]);

  const todayISO = useMemo(() => toISODate(new Date()), []);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const from = toISODate(weekStart);
      const to = toISODate(addDays(weekStart, 7));
      const data = await getBookingsRange(from, to);
      setBookings(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Errore caricamento prenotazioni.");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings, refreshKey]);

  const bookingsByDate = useMemo(() => {
    const map = new Map();
    weekDays.forEach(({ iso }) => map.set(iso, []));
    bookings.forEach(b => {
      const iso = b.startTime ? toISODate(new Date(b.startTime)) : null;
      if (iso && map.has(iso)) {
        map.get(iso).push(b);
      }
    });
    map.forEach(arr => arr.sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
    return map;
  }, [bookings, weekDays]);

  const [nowLine, setNowLine] = useState(null);

  useEffect(() => {
    const updateNowLine = () => {
      const now = new Date();
      const today = toISODate(now);
      const dayIdx = weekDays.findIndex(d => d.iso === today);
      if (dayIdx < 0) {
        setNowLine(null);
        return;
      }
      const currentMin = now.getHours() * 60 + now.getMinutes();
      if (currentMin < GRID_START_MIN || currentMin >= GRID_END_HOUR * 60) {
        setNowLine(null);
        return;
      }
      const topPx = currentMin - GRID_START_MIN;
      setNowLine({ dayIdx, topPx });
    };

    updateNowLine();
    const id = setInterval(updateNowLine, 60 * 1000);
    return () => clearInterval(id);
  }, [weekDays]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el || !nowLine || loading) return;
    const scrollTop = nowLine.topPx - 120;
    if (scrollTop > 0) {
      el.scrollTop = scrollTop;
    }
  }, [nowLine, loading]);

  const handleSlotClick = useCallback(
    (dateISO, hour) => {
      onSlotClick?.(dateISO, hour);
    },
    [onSlotClick],
  );

  const weekLabel = useMemo(() => {
    const d1 = weekDays[0]?.date;
    const d2 = weekDays[6]?.date;
    if (!d1 || !d2) return "";
    const m = d1.getMonth();
    const sameMonth = d2.getMonth() === m;
    if (sameMonth) {
      return `${d1.getDate()} – ${d2.getDate()} ${MONTH_IT[m]} ${d1.getFullYear()}`;
    }
    return `${d1.getDate()} ${MONTH_IT[d1.getMonth()]} – ${d2.getDate()} ${MONTH_IT[d2.getMonth()]} ${d1.getFullYear()}`;
  }, [weekDays]);

  const anchorISO = toISODate(anchorDate);
  const hours = useMemo(() => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i), []);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center py-5">
        <Spinner />
        <span className="ms-2 text-muted">Caricamento settimana…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger mb-0">
        {error}
      </div>
    );
  }

  return (
    <div className="ag-week-wrapper">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="ag-btn ag-btn--soft" onClick={onPrevWeek} title="Settimana precedente">
            ‹ Prev
          </button>
          <span className="ag-week-label">{weekLabel}</span>
          <button type="button" className="ag-btn ag-btn--soft" onClick={onNextWeek} title="Settimana successiva">
            Next ›
          </button>
        </div>
      </div>

      <div ref={gridRef} className="ag-week">
        <div className="ag-week__grid">
          <div className="ag-week__header-cell ag-week__time-header" style={{ gridRow: 1, gridColumn: 1 }} />
          {weekDays.map((d, idx) => (
            <div
              key={d.iso}
              className={`ag-week__header-cell ${d.iso === todayISO ? "is-today" : ""} ${d.iso === anchorISO ? "is-selected" : ""}`}
              style={{ gridRow: 1, gridColumn: idx + 2 }}
              onClick={() => onDayClick?.(d.iso)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && onDayClick?.(d.iso)}
            >
              <span className="dow">{DOW_IT[(idx + 1) % 7]}</span>
              <span className="dd">{d.date.getDate()} {MONTH_IT[d.date.getMonth()].slice(0, 3)}</span>
            </div>
          ))}

          {hours.map((hour, i) => (
            <div key={`time-${hour}`} className="ag-week__time-col ag-week__hour-row" style={{ gridRow: i + 2, gridColumn: 1 }}>
              {pad2(hour)}:00
            </div>
          ))}

          {weekDays.map((d, dayIdx) => (
            <div
              key={d.iso}
              className="ag-week__day-col"
              style={{ gridColumn: dayIdx + 2, gridRow: "2 / -1" }}
            >
              {hours.map(hour => (
                <div
                  key={hour}
                  className="ag-week__hour-slot"
                  data-date-iso={d.iso}
                  data-hour={hour}
                  onClick={e => {
                    e.stopPropagation();
                    handleSlotClick(d.iso, hour);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && handleSlotClick(d.iso, hour)}
                />
              ))}
              {(bookingsByDate.get(d.iso) || []).map(b => {
                const start = new Date(b.startTime);
                const end = new Date(b.endTime);
                const startMin = start.getHours() * 60 + start.getMinutes();
                const endMin = end.getHours() * 60 + end.getMinutes();
                const durationMin = Math.max(30, endMin - startMin);
                const topPx = startMin - GRID_START_MIN;
                const heightPx = Math.max((durationMin / 60) * HOUR_HEIGHT, 30);

                return (
                  <div
                    key={b.bookingId}
                    className={`ag-week-block ag-week-block--${["CONFIRMED", "COMPLETED", "CANCELLED"].includes(b.status) ? b.status : "PENDING"}`}
                    style={{
                      top: topPx,
                      height: heightPx,
                      minHeight: 30,
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      onBookingClick?.(b);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && onBookingClick?.(b)}
                  >
                    <div className="ag-week-block__name">{b.customerName || "—"}</div>
                    {heightPx >= 50 && (
                      <>
                        <div className="ag-week-block__service">{b.serviceTitle || ""}</div>
                        <div className="ag-week-block__time">
                          {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {nowLine?.dayIdx === dayIdx && (
                <div className="ag-week-nowline" style={{ top: nowLine.topPx }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
