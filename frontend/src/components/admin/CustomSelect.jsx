import { useEffect, useRef, useState } from "react";

export default function CustomSelect({ value, onChange, options, placeholder, isInvalid }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div ref={ref} className={`ag-custom-select${isInvalid ? " is-invalid" : ""}`} style={{ position: "relative" }}>
      <button
        type="button"
        className={`ag-custom-select__trigger form-control${isInvalid ? " is-invalid" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "" : "ag-custom-select__placeholder"}>{selected ? selected.label : placeholder}</span>
        <span className="ag-custom-select__arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <ul className="ag-custom-select__menu" role="listbox">
          {options.map(o => (
            <li
              key={o.value}
              role="option"
              aria-selected={String(o.value) === String(value)}
              className={`ag-custom-select__option${String(o.value) === String(value) ? " is-selected" : ""}`}
              onMouseDown={e => {
                e.preventDefault();
                onChange(String(o.value));
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
