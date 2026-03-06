import { useCallback, useEffect, useRef, useState } from "react";
import { searchCustomers } from "../../api/modules/customer.api";

export default function CustomerAutocomplete({ value, onChange, onSelect, isInvalid = false, placeholder = "Cerca o inserisci nome cliente…" }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // ── Click outside → close ──────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Cleanup debounce on unmount ────────────────────────────────────────
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // ── Debounced API call ─────────────────────────────────────────────────
  const doSearch = useCallback(async q => {
    if (q.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setIsLoading(true);
    try {
      const results = await searchCustomers(q);
      setSuggestions(results);
      setShowDropdown(true);
      setActiveIndex(-1);
    } catch {
      // Network errors: fail silently — user can still type freely
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Text change handler ────────────────────────────────────────────────
  const handleChange = e => {
    const v = e.target.value;
    onChange(v);

    clearTimeout(debounceRef.current);

    if (v.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(v), 300);
  };

  // ── Selection ─────────────────────────────────────────────────────────
  const handleSelect = useCallback(
    customer => {
      onSelect(customer);
      setSuggestions([]);
      setShowDropdown(false);
      setActiveIndex(-1);
    },
    [onSelect],
  );

  // ── Keyboard navigation ────────────────────────────────────────────────
  const handleKeyDown = e => {
    if (!showDropdown || !suggestions.length) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (activeIndex >= 0) {
          e.preventDefault();
          handleSelect(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
      default:
        break;
    }
  };

  const dropdownVisible = (showDropdown || isLoading) && value.length >= 2;

  return (
    <>
      <div ref={containerRef} className="ag-autocomplete">
        <input
          className={`form-control${isInvalid ? " is-invalid" : ""}`}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={dropdownVisible}
          aria-haspopup="listbox"
          aria-activedescendant={activeIndex >= 0 ? `ag-ac-opt-${activeIndex}` : undefined}
        />

        {dropdownVisible && (
          <div className="ag-autocomplete__dropdown" role="listbox">
            {isLoading && (
              <div className="ag-autocomplete__hint" aria-live="polite">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Ricerca…
              </div>
            )}

            {!isLoading && suggestions.length === 0 && (
              <div className="ag-autocomplete__hint" aria-live="polite">
                Nessun cliente trovato — verrà creato automaticamente
              </div>
            )}

            {!isLoading &&
              suggestions.map((c, i) => (
                <div
                  key={c.customerId}
                  id={`ag-ac-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`ag-autocomplete__item${i === activeIndex ? " is-active" : ""}`}
                  // mousedown fires before blur, so the dropdown stays open
                  onMouseDown={() => handleSelect(c)}
                >
                  <span className="ag-autocomplete__name">{c.fullName}</span>
                  {c.phone && <span className="ag-autocomplete__meta"> · {c.phone}</span>}
                  {c.email && !c.email.includes("@beautyroom.local") && <span className="ag-autocomplete__meta"> · {c.email}</span>}
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
