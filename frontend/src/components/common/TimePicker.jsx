import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import "./TimePicker.css";

const ITEM_H = 44;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2) * ITEM_H; // 88px top/bottom spacer

// ── Helpers ──────────────────────────────────────────────────────────────────

function initTime(value, minuteStep) {
  if (value && /^\d{2}:\d{2}$/.test(value)) return value;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const rawM = now.getMinutes();
  const rounded = Math.round(rawM / minuteStep) * minuteStep;
  const m = String(rounded >= 60 ? 60 - minuteStep : rounded).padStart(2, "0");
  return `${h}:${m}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimePicker({ value, onChange, minuteStep = 5, label, className }) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);

  const minutes = useMemo(() => Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, "0")), [minuteStep]);

  // ── Single source of truth ────────────────────────────────────────────────
  // internalValue: always a valid "HH:mm" string — drums and confirm read from this
  // inputText:     what the keyboard input shows — may be a partial string mid-typing
  const [internalValue, setInternalValue] = useState(() => initTime(value, minuteStep));
  const [inputText, setInputText] = useState(() => initTime(value, minuteStep));
  const [open, setOpen] = useState(false);

  const containerRef = useRef(null);
  const hourColRef = useRef(null);
  const minColRef = useRef(null);
  const hourScrollTimeout = useRef(null);
  const minScrollTimeout = useRef(null);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── External value sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (value && /^\d{2}:\d{2}$/.test(value) && value !== internalValue) {
      setInternalValue(value);
      setInputText(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // ── Sync drums whenever internalValue or open changes ────────────────────
  useEffect(() => {
    if (!open) return;
    const [hStr, mStr] = internalValue.split(":");
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;

    if (hourColRef.current) {
      hourColRef.current.scrollTop = h * ITEM_H;
    }
    if (minColRef.current) {
      const mIdx = Math.round(m / minuteStep);
      minColRef.current.scrollTop = mIdx * ITEM_H;
    }
  }, [internalValue, open, minuteStep]);

  // ── Wheel handlers (one-step-at-a-time on desktop) ───────────────────────
  useEffect(() => {
    if (!open) return;
    const hCol = hourColRef.current;
    const mCol = minColRef.current;
    if (!hCol || !mCol) return;

    const makeWheelHandler = col => e => {
      e.preventDefault();
      col.scrollBy({ top: Math.sign(e.deltaY) * ITEM_H, behavior: "smooth" });
    };

    const onHWheel = makeWheelHandler(hCol);
    const onMWheel = makeWheelHandler(mCol);

    hCol.addEventListener("wheel", onHWheel, { passive: false });
    mCol.addEventListener("wheel", onMWheel, { passive: false });

    return () => {
      hCol.removeEventListener("wheel", onHWheel);
      mCol.removeEventListener("wheel", onMWheel);
    };
  }, [open]);

  // ── Scroll timeout cleanup on unmount ─────────────────────────────────────
  useEffect(
    () => () => {
      clearTimeout(hourScrollTimeout.current);
      clearTimeout(minScrollTimeout.current);
    },
    [],
  );

  // ── Drum scroll handlers ──────────────────────────────────────────────────
  const handleHourScroll = useCallback(() => {
    clearTimeout(hourScrollTimeout.current);
    hourScrollTimeout.current = setTimeout(() => {
      if (!hourColRef.current) return;
      const idx = Math.max(0, Math.min(23, Math.round(hourColRef.current.scrollTop / ITEM_H)));
      hourColRef.current.scrollTop = idx * ITEM_H; // snap to exact position
      const h = String(idx).padStart(2, "0");
      setInternalValue(prev => {
        const currentM = prev.split(":")[1] ?? "00";
        const next = `${h}:${currentM}`;
        setInputText(next);
        return next;
      });
    }, 120);
  }, []);

  const handleMinScroll = useCallback(() => {
    clearTimeout(minScrollTimeout.current);
    minScrollTimeout.current = setTimeout(() => {
      if (!minColRef.current) return;
      const maxIdx = Math.floor(60 / minuteStep) - 1;
      const idx = Math.max(0, Math.min(maxIdx, Math.round(minColRef.current.scrollTop / ITEM_H)));
      minColRef.current.scrollTop = idx * ITEM_H; // snap to exact position
      const m = String(idx * minuteStep).padStart(2, "0");
      setInternalValue(prev => {
        const currentH = prev.split(":")[0] ?? "00";
        const next = `${currentH}:${m}`;
        setInputText(next);
        return next;
      });
    }, 120);
  }, [minuteStep]);

  // ── Derived selected indices for CSS highlight ────────────────────────────
  const { hourIdx, minIdx } = useMemo(() => {
    const [hStr = "0", mStr = "0"] = internalValue.split(":");
    const h = Math.max(0, Math.min(parseInt(hStr, 10) || 0, 23));
    const m = parseInt(mStr, 10) || 0;
    const mI = minutes.indexOf(String(m).padStart(2, "0"));
    return { hourIdx: h, minIdx: mI >= 0 ? mI : 0 };
  }, [internalValue, minutes]);

  // ── Keyboard input handler ────────────────────────────────────────────────
  const handleKeyboardInput = e => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "").slice(0, 4); // solo cifre, max 4
    const isDeleting = raw.length < inputText.length;

    let v = digits;
    if (digits.length > 2) {
      v = digits.slice(0, 2) + ":" + digits.slice(2); // 3ª cifra → minuti
    } else if (digits.length === 2 && !isDeleting) {
      v = digits + ":"; // colon dopo 2 cifre
    }
    setInputText(v);

    if (/^\d{2}:\d{2}$/.test(v)) {
      const [h, m] = v.split(":").map(Number);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        setInternalValue(v);
      }
    }
  };

  // ── Confirm ───────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    const finalVal = /^\d{2}:\d{2}$/.test(inputText) ? inputText : internalValue;
    onChange(finalVal);
    setOpen(false);
  };

  // ── Open / close toggle ───────────────────────────────────────────────────
  const handleOpen = () => {
    setInputText(internalValue); // reset partial keyboard input each time panel opens
    setOpen(o => !o);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={`tp-wrapper${className ? ` ${className}` : ""}`}>
      {label && <div className="tp-label">{label}</div>}

      {/* Collapsed trigger */}
      <div className={`tp-trigger${open ? " is-open" : ""}`} onClick={handleOpen} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && handleOpen()}>
        <span className="tp-trigger__icon">🕐</span>
        {value ? <span className="tp-trigger__value">{value}</span> : <span className="tp-trigger__placeholder">— : —</span>}
        <span className="tp-trigger__arrow">▾</span>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="tp-panel">
          <input type="text" className="tp-keyboard-input" value={inputText} onChange={handleKeyboardInput} placeholder="09:00" maxLength={5} />

          <div className="tp-drum">
            <div className="tp-col-wrap">
              <div ref={hourColRef} className="tp-col" onScroll={handleHourScroll}>
                <div className="tp-spacer" style={{ height: PAD }} />
                {hours.map((h, i) => (
                  <div key={h} className={`tp-item${i === hourIdx ? " tp-item--selected" : ""}`}>
                    {h}
                  </div>
                ))}
                <div className="tp-spacer" style={{ height: PAD }} />
              </div>
            </div>

            <div className="tp-colon">:</div>

            <div className="tp-col-wrap">
              <div ref={minColRef} className="tp-col" onScroll={handleMinScroll}>
                <div className="tp-spacer" style={{ height: PAD }} />
                {minutes.map((m, i) => (
                  <div key={m} className={`tp-item${i === minIdx ? " tp-item--selected" : ""}`}>
                    {m}
                  </div>
                ))}
                <div className="tp-spacer" style={{ height: PAD }} />
              </div>
            </div>
          </div>

          <button type="button" className="tp-confirm-btn" onClick={handleConfirm}>
            Conferma
          </button>
        </div>
      )}
    </div>
  );
}
