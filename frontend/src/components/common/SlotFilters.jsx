import "./SlotFilters.css";

/**
 * SlotFilters — filtri (SOLO restringenti) per il finder "prossimo disponibile" cliente.
 * Presentazionale e controllato: non fa fetch, emette solo il nuovo value.
 *
 * value    { dows: string[], daypart: 'MATTINA'|'PRIMO_POMERIGGIO'|'TARDO_POMERIGGIO'|null }
 * onChange (next) => void   — riceve la stessa shape { dows, daypart }
 * className (opzionale)
 *
 * I giorni sono valori enum Java (MONDAY…SUNDAY) così il backend li mappa a Set<DayOfWeek>.
 * La traduzione daypart → finestra oraria vive qui (DAYPART_WINDOWS / daypartToWindow):
 * unica fonte di verità condivisa da entrambi i flussi cliente.
 */

// Finestre daypart — bande fisse sugli orari reali del salone (niente va oltre le 18:30).
// Il backend le restringe comunque agli open range reali → possono solo restringere.
// windowStart null = nessun lower bound (la mattina apre alle 09:00 negli orari reali).
export const DAYPART_WINDOWS = {
  MATTINA: { windowStart: null, windowEnd: "12:00" },
  PRIMO_POMERIGGIO: { windowStart: "13:00", windowEnd: "16:00" },
  TARDO_POMERIGGIO: { windowStart: "16:00", windowEnd: null },
};

export const daypartToWindow = daypart =>
  DAYPART_WINDOWS[daypart] ?? { windowStart: null, windowEnd: null };

// Lun-Sab (domenica chiusa), label IT → valore enum Java.
const DOWS = [
  { key: "MONDAY", label: "Lun" },
  { key: "TUESDAY", label: "Mar" },
  { key: "WEDNESDAY", label: "Mer" },
  { key: "THURSDAY", label: "Gio" },
  { key: "FRIDAY", label: "Ven" },
  { key: "SATURDAY", label: "Sab" },
];

const DAYPARTS = [
  { key: "MATTINA", label: "Mattina", caption: "9–12" },
  { key: "PRIMO_POMERIGGIO", label: "Primo pomeriggio", caption: "13–16" },
  { key: "TARDO_POMERIGGIO", label: "Tardo pomeriggio", caption: "dopo le 16" },
];

export default function SlotFilters({ value, onChange, className = "" }) {
  const dows = value?.dows ?? [];
  const daypart = value?.daypart ?? null;
  const hasActive = dows.length > 0 || daypart != null;

  const toggleDow = key => {
    const next = dows.includes(key) ? dows.filter(d => d !== key) : [...dows, key];
    onChange({ dows: next, daypart });
  };

  // Single-select: click sull'attivo → deseleziona.
  const toggleDaypart = key => onChange({ dows, daypart: daypart === key ? null : key });

  const clear = () => onChange({ dows: [], daypart: null });

  return (
    <div className={`bm-slot-filters ${className}`.trim()}>
      <div className="bm-slot-filters__head">
        <span className="bm-slot-filters__label">Filtra la ricerca</span>
        {hasActive && (
          <button type="button" className="bm-slot-filters__clear" onClick={clear}>
            Cancella filtri
          </button>
        )}
      </div>

      <div className="bm-dow-pills" role="group" aria-label="Giorni della settimana">
        {DOWS.map(({ key, label }) => {
          const active = dows.includes(key);
          return (
            <button
              key={key}
              type="button"
              className={`bm-dow-pill${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => toggleDow(key)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="bm-daypart-chips" role="group" aria-label="Fascia oraria">
        {DAYPARTS.map(({ key, label, caption }) => {
          const active = daypart === key;
          return (
            <button
              key={key}
              type="button"
              className={`bm-daypart-chip${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => toggleDaypart(key)}
            >
              <span className="bm-daypart-chip__label">{label}</span>
              <span className="bm-daypart-chip__hint">{caption}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
