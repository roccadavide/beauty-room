import { useMemo, useId } from "react";
import "./DurationField.css";

/**
 * Controlled duration picker that renders two native <select> elements
 * (hours + minutes) and reports the combined total to the parent as a
 * single integer of minutes. Fully stateless — derives everything from props.
 *
 * @param {object}                            props
 * @param {number|null}                       props.value        - Total minutes. null = unset.
 * @param {(totalMinutes: number|null)=>void} props.onChange
 * @param {string}                           [props.label]       - Visible label / legend text.
 * @param {string}                           [props.id]          - Root id prefix; auto-generated if omitted.
 * @param {number}                           [props.minuteStep=5]
 * @param {number}                           [props.maxHours=8]
 * @param {boolean}                          [props.disabled=false]
 * @param {boolean}                          [props.required=false] - No placeholder, no clear button.
 * @param {string}                           [props.helperText]
 * @param {string}                           [props.error]       - Shown as text; turns border red.
 * @param {string}                           [props.className]   - Passed through to root element.
 */
export default function DurationField({
  value,
  onChange,
  label,
  id,
  minuteStep = 5,
  maxHours = 8,
  disabled = false,
  required = false,
  helperText,
  error,
  className,
}) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  // Both ids linked so screen readers announce both when relevant
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;

  const isNull = value == null;
  const currentHours = isNull ? null : Math.floor(value / 60);
  const currentMins = isNull ? null : value % 60;

  // Build options lists. Extended automatically when the incoming value falls
  // outside the configured grid so we never silently corrupt data on mount.
  const { hourOptions, minuteOptions } = useMemo(() => {
    const hMax = currentHours != null && currentHours > maxHours ? currentHours : maxHours;
    const hours = Array.from({ length: hMax + 1 }, (_, i) => i);

    const minutes = [];
    for (let m = 0; m < 60; m += minuteStep) minutes.push(m);
    if (currentMins != null && !minutes.includes(currentMins)) {
      minutes.push(currentMins);
      minutes.sort((a, b) => a - b);
    }

    return { hourOptions: hours, minuteOptions: minutes };
  }, [maxHours, minuteStep, currentHours, currentMins]);

  // Handlers — called only on real user interaction, never on mount
  function handleHoursChange(e) {
    const h = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
    onChange(h * 60 + (currentMins ?? 0));
  }

  function handleMinutesChange(e) {
    const m = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
    onChange((currentHours ?? 0) * 60 + m);
  }

  function handleClear() {
    onChange(null);
  }

  // Live readout derived from current value
  let readout = null;
  if (!isNull && value > 0) {
    const h = Math.floor(value / 60);
    const m = value % 60;
    if (h === 0) readout = `${m} min`;
    else if (m === 0) readout = `${h} h`;
    else readout = `${h} h ${m} min`;
  }

  const hoursValue = isNull ? (required ? "0" : "") : String(currentHours);
  const minutesValue = isNull ? (required ? "0" : "") : String(currentMins);
  const hasError = Boolean(error);

  const rootClass = ["dur-field", disabled && "dur-field--disabled", hasError && "dur-field--error", className].filter(Boolean).join(" ");

  return (
    <fieldset className={rootClass} disabled={disabled}>
      {label && (
        <legend className="dur-legend">
          {label}
          {required && (
            <span className="dur-required" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </legend>
      )}

      <div className="dur-group">
        {/* Hours select */}
        <div className="dur-pair">
          <select
            id={`${fieldId}-hours`}
            className="dur-select"
            value={hoursValue}
            onChange={handleHoursChange}
            aria-label="Ore"
            aria-required={required || undefined}
            aria-invalid={hasError ? "true" : undefined}
            aria-describedby={describedBy}
          >
            {!required && <option value="">—</option>}
            {hourOptions.map(h => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span className="dur-unit" aria-hidden="true">
            h
          </span>
        </div>

        {/* Minutes select */}
        <div className="dur-pair">
          <select
            id={`${fieldId}-minutes`}
            className="dur-select"
            value={minutesValue}
            onChange={handleMinutesChange}
            aria-label="Minuti"
            aria-required={required || undefined}
            aria-invalid={hasError ? "true" : undefined}
            aria-describedby={describedBy}
          >
            {!required && <option value="">—</option>}
            {minuteOptions.map(m => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
          <span className="dur-unit" aria-hidden="true">
            min
          </span>
        </div>

        {/* Clear control — only when optional and a value is set */}
        {!required && !isNull && (
          <button type="button" className="dur-clear" onClick={handleClear} aria-label="Rimuovi durata">
            ✕
          </button>
        )}
      </div>

      {/* Live readout */}
      {readout && (
        <p className="dur-readout" aria-live="polite">
          {readout}
        </p>
      )}

      {/* Helper text — hidden when error is shown */}
      {helperText && !error && (
        <p id={helperId} className="dur-helper">
          {helperText}
        </p>
      )}

      {/* Error — always rendered as visible text, never color-only */}
      {error && (
        <p id={errorId} role="alert" className="dur-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
