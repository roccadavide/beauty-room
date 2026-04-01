import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MOBILE_MAX_PX = 575;

function ChevronIcon() {
  return (
    <svg className="custom-select__chevron" width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path d="M5 7.5 L10 12.5 L15 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="custom-select__check" width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M4 9 L8 13 L14 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function normVal(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * @param {Object} props
 * @param {{ value: string|number, label: string, subtitle?: string }[]} props.options
 * @param {string|number|null|undefined|string[]} props.value — single value, or string[] when multiple
 * @param {(v: string|null|string[]) => void} props.onChange
 * @param {boolean} [props.multiple]
 * @param {boolean} [props.searchable=true]
 */
export default function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder = "Seleziona…",
  label,
  searchable = true,
  disabled = false,
  error = null,
  isInvalid = false,
  className = "",
  multiple = false,
}) {
  const id = useId();
  const rootRef = useRef(null);
  const portalRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => {
      if (rootRef.current?.contains(e.target)) return;
      if (portalRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (open && searchable && searchRef.current) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    if (!open) setSearch("");
  }, [open, searchable]);

  const selectedSingle = useMemo(() => {
    if (multiple) return null;
    const v = normVal(value);
    return options.find(o => normVal(o.value) === v) ?? null;
  }, [multiple, options, value]);

  const selectedMultipleSet = useMemo(() => {
    if (!multiple || !Array.isArray(value)) return new Set();
    return new Set(value.map(normVal));
  }, [multiple, value]);

  const triggerLabel = useMemo(() => {
    if (multiple && Array.isArray(value)) {
      if (!value.length) return null;
      const labels = value.map(v => options.find(o => normVal(o.value) === normVal(v))?.label).filter(Boolean);
      if (!labels.length) return null;
      if (labels.length <= 2) return labels.join(", ");
      return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
    }
    return selectedSingle?.label ?? null;
  }, [multiple, options, selectedSingle, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !searchable) return options;
    return options.filter(o => {
      const lab = (o.label || "").toLowerCase();
      const sub = (o.subtitle || "").toLowerCase();
      return lab.includes(q) || sub.includes(q);
    });
  }, [options, search, searchable]);

  const showError = Boolean(error) || isInvalid;

  const toggleMulti = useCallback(
    optVal => {
      const key = normVal(optVal);
      const cur = Array.isArray(value) ? [...value] : [];
      const i = cur.findIndex(x => normVal(x) === key);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(optVal);
      onChange?.(cur);
    },
    [onChange, value],
  );

  const pickSingle = useCallback(
    optVal => {
      onChange?.(normVal(optVal));
      setOpen(false);
    },
    [onChange],
  );

  const handleTriggerClick = () => {
    if (disabled) return;
    setOpen(o => !o);
  };

  const listContent = (
    <>
      {searchable && (
        <div className="custom-select__search-wrap">
          <input
            ref={searchRef}
            type="search"
            className="custom-select__search"
            placeholder="Cerca…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
      <ul className="custom-select__list" role="listbox" aria-multiselectable={multiple}>
        {filtered.length === 0 && <li className="custom-select__empty">Nessun risultato</li>}
        {filtered.map(o => {
          const v = normVal(o.value);
          const isSel = multiple ? selectedMultipleSet.has(v) : normVal(value) === v;
          return (
            <li key={v} role="option" aria-selected={isSel}>
              <button
                type="button"
                className={`custom-select__option${isSel ? " is-selected" : ""}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  if (multiple) toggleMulti(o.value);
                  else pickSingle(o.value);
                }}
              >
                <span className="custom-select__option-text">
                  <span className="custom-select__option-label">{o.label}</span>
                  {o.subtitle ? <span className="custom-select__option-sub">{o.subtitle}</span> : null}
                </span>
                {isSel && (
                  <span className="custom-select__option-check">
                    <CheckIcon />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );

  const portalSheet =
    open && isMobile
      ? createPortal(
          <>
            <div className="custom-select__backdrop" aria-hidden onClick={() => setOpen(false)} />
            <div ref={portalRef} className="custom-select__sheet-portal" role="dialog" aria-modal="true">
              <div className="custom-select__handle" aria-hidden />
              {listContent}
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`custom-select ${showError ? "custom-select--error" : ""} ${className}`.trim()}>
      {label ? (
        <label className="custom-select__label" htmlFor={`${id}-trigger`}>
          {label}
        </label>
      ) : null}
      <button
        id={`${id}-trigger`}
        type="button"
        className="custom-select__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={showError}
        onClick={handleTriggerClick}
      >
        <span className={triggerLabel ? "custom-select__value" : "custom-select__value custom-select__value--placeholder"}>{triggerLabel ?? placeholder}</span>
        <ChevronIcon />
      </button>

      {open && !isMobile && <div className="custom-select__dropdown">{listContent}</div>}

      {portalSheet}

      {error ? <div className="custom-select__error">{error}</div> : null}
    </div>
  );
}
