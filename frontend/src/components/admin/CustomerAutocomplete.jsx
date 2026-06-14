import { useCallback, useEffect, useRef, useState } from "react";
import { searchCustomers } from "../../api/modules/customer.api";

const toTitleCase = str =>
  str ? str.replace(/\b\w/g, c => c.toUpperCase()) : str;

export default function CustomerAutocomplete({ value, onChange, onSelect, onNoMatch, isInvalid = false, placeholder = "Cerca o inserisci nome cliente…" }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // onNoMatch is optional and surfaces "the current query matched no DB customer"
  // (fail-closed: only true after a completed search returns zero results). Held
  // in a ref so doSearch/handlers stay stable and the parent need not memoize it.
  const onNoMatchRef = useRef(onNoMatch);
  useEffect(() => {
    onNoMatchRef.current = onNoMatch;
  }, [onNoMatch]);
  const emitNoMatch = useCallback(v => onNoMatchRef.current?.(v), []);

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
      emitNoMatch(false);
      return;
    }
    setIsLoading(true);
    try {
      const results = await searchCustomers(q);
      setSuggestions(results);
      setShowDropdown(true);
      setActiveIndex(-1);
      emitNoMatch(results.length === 0);
    } catch {
      // Network errors: fail silently — user can still type freely.
      // Fail-closed on the no-match signal: we can't assert "no DB match"
      // when the lookup itself failed, so never offer to create from here.
      setSuggestions([]);
      setShowDropdown(false);
      emitNoMatch(false);
    } finally {
      setIsLoading(false);
    }
  }, [emitNoMatch]);

  // ── Text change handler ────────────────────────────────────────────────
  const handleChange = e => {
    const v = e.target.value;
    onChange(v);

    clearTimeout(debounceRef.current);

    if (v.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      emitNoMatch(false);
      return;
    }
    // Fail-closed while a new query is pending: clear the no-match signal until
    // the debounced search confirms it, so the parent never offers "create"
    // against an unchecked name.
    emitNoMatch(false);
    debounceRef.current = setTimeout(() => doSearch(v), 300);
  };

  // ── Selection ─────────────────────────────────────────────────────────
  const handleSelect = useCallback(
    customer => {
      onSelect(customer);
      setSuggestions([]);
      setShowDropdown(false);
      setActiveIndex(-1);
      emitNoMatch(false);
    },
    [onSelect, emitNoMatch],
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
          onBlur={e => {
            const titled = toTitleCase(e.target.value);
            if (titled !== e.target.value) onChange(titled);
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
                  {c.phone && <span className="ag-autocomplete__meta">{c.phone}</span>}
                  {c.email && !c.email.includes("@beautyroom.local") && <span className="ag-autocomplete__meta">{c.email}</span>}
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
