import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Inline date-range calendar.
 *
 * Visual layer reuses DateTimeField's `.dtf-*` CSS classes (header, nav, grid,
 * dow, day) plus 4 new modifiers added in `_date-time-field.css`:
 *   .dtf-day--range-start  .dtf-day--range-end  .dtf-day--range-single  .dtf-day--in-range
 *
 * Selection rules (per spec):
 *   - No selection → first tap sets start (single-day: start === end).
 *   - Currently single-day, tap LATER → that becomes end (range).
 *   - Currently single-day, tap EARLIER → reset (new single-day on tapped day).
 *   - Complete range exists, tap ANY day → reset to new single-day on tapped day.
 *   - Tap same day twice → stays single-day.
 *
 * The component never owns the (start, end) state — it stays controlled and
 * fires onChange with the new pair so the parent stays the single source of truth.
 */

const pad2 = n => String(n).padStart(2, "0");

const toISO = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseISO = iso => {
  if (!iso || typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

const DOW_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export default function RangeCalendar({
  startDate,
  endDate,
  onChange,
  minDate,
  className = "",
}) {
  const minISO = useMemo(() => {
    if (!minDate) return null;
    if (minDate instanceof Date) return toISO(minDate);
    if (typeof minDate === "string") return minDate.slice(0, 10);
    return null;
  }, [minDate]);

  // View month: init to startDate's month, else minDate's, else today.
  const initView = useMemo(() => {
    const ref = parseISO(startDate) || parseISO(minISO) || new Date();
    return { year: ref.getFullYear(), month: ref.getMonth() };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [viewYear, setViewYear] = useState(initView.year);
  const [viewMonth, setViewMonth] = useState(initView.month);

  // If startDate changes externally to a different month (e.g. editing a saved
  // closure), bring the calendar's view to that month so the selection is on-screen.
  useEffect(() => {
    const d = parseISO(startDate);
    if (!d) return;
    if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
    // intentional: only react to startDate changes, not to the user navigating months
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDOW = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = (firstDOW + 6) % 7; // Monday-first
  const monthName = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const todayISO = useMemo(() => toISO(new Date()), []);

  const isPast = useCallback(iso => minISO != null && iso < minISO, [minISO]);

  const sd = startDate || null;
  const ed = endDate || null;
  const isSingle = !!sd && !!ed && sd === ed;
  const isCompleteRange = !!sd && !!ed && sd < ed;

  const handleDayClick = useCallback(day => {
    if (!day) return;
    const iso = toISO(new Date(viewYear, viewMonth, day));
    if (isPast(iso)) return;

    // Rule cascade:
    //   • currently single-day and tapped day is LATER  → expand end
    //   • everything else (no selection, earlier tap, or complete range) → reset
    if (isSingle && iso > sd) {
      onChange?.({ startDate: sd, endDate: iso });
    } else {
      onChange?.({ startDate: iso, endDate: iso });
    }
  }, [viewYear, viewMonth, isPast, isSingle, sd, onChange]);

  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < startOffset; i++) arr.push({ key: `e-${i}`, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISO(new Date(viewYear, viewMonth, d));
      arr.push({
        key: iso,
        day: d,
        iso,
        past: isPast(iso),
        today: iso === todayISO,
        isStart: !!sd && iso === sd,
        isEnd:   !!ed && iso === ed,
        inRange: isCompleteRange && iso > sd && iso < ed,
        isSingle: isSingle && iso === sd,
      });
    }
    return arr;
  }, [daysInMonth, startOffset, viewYear, viewMonth, todayISO, isPast, sd, ed, isSingle, isCompleteRange]);

  return (
    <div className={`dtf dtf--inline ${className}`.trim()}>
      <div className="dtf-panel-inner">
        <div className="dtf-cal-wrap" key={`${viewYear}-${viewMonth}`}>
          <div className="dtf-header">
            <button type="button" className="dtf-nav-btn" onClick={prevMonth} aria-label="Mese precedente">‹</button>
            <span className="dtf-month-label">{monthName}</span>
            <button type="button" className="dtf-nav-btn" onClick={nextMonth} aria-label="Mese successivo">›</button>
          </div>
          <div className="dtf-grid" role="grid">
            {DOW_LABELS.map(l => (
              <div key={l} className="dtf-dow">{l}</div>
            ))}
            {cells.map(c => {
              const classes = ["dtf-day"];
              if (c.day == null) {
                classes.push("dtf-day--empty");
              } else {
                if (c.past) classes.push("dtf-day--past");
                if (c.today && !c.isStart && !c.isEnd) classes.push("dtf-day--today");
                if (c.isSingle) {
                  classes.push("dtf-day--range-single");
                } else {
                  if (c.isStart) classes.push("dtf-day--range-start");
                  if (c.isEnd)   classes.push("dtf-day--range-end");
                  if (c.inRange) classes.push("dtf-day--in-range");
                }
              }
              return (
                <div
                  key={c.key}
                  className={classes.join(" ")}
                  role={c.day ? "button" : undefined}
                  tabIndex={c.day && !c.past ? 0 : undefined}
                  aria-label={c.iso || undefined}
                  aria-pressed={c.isStart || c.isEnd || c.inRange || undefined}
                  onClick={() => handleDayClick(c.day)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleDayClick(c.day);
                    }
                  }}
                >
                  {c.day != null && <span className="dtf-day-num">{c.day}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
