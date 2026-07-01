import SlotFilters from "./SlotFilters";
import "./SlotFinderCard.css";

// "Martedì 8 luglio · 14:30" — weekday capitalized + start time.
// Months stay lowercase (Italian convention) → capitalize only the first letter.
function formatSlot(slot) {
  const d = new Date(slot.date + "T12:00:00");
  const label = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capitalized} · ${slot.startTime}`;
}

/**
 * SlotFinderCard — unico contenitore dello Step 1 "quando".
 * Presentazionale e controllato: NON possiede la logica del finder. Il flusso tiene
 * hook + stato e passa tutto qui dentro (stesse props che alimentavano NextSlotBanner).
 *
 * Props:
 *   filterValue     { dows, daypart }        — value di SlotFilters (stato del flusso)
 *   onFilterChange  (next) => void           — setter di SlotFilters (stato del flusso)
 *   slot            { date, startTime, endTime } | null — slot mostrato (primo o avanzato)
 *   loading         boolean                  — ricerca in corso
 *   onBook          (slot) => void           — "Prenota questo orario" (STESSO handler di onSelect)
 *   onFindAnother   () => void               — "Cerca un altro orario" (avanza allo slot successivo)
 *   noMore          boolean (opzionale)      — nessun altro slot oltre quello mostrato (coi filtri attivi)
 *   emptyText       string (opzionale)       — override della copy vuota
 */
export default function SlotFinderCard({
  filterValue,
  onFilterChange,
  slot,
  loading,
  onBook,
  onFindAnother,
  noMore = false,
  emptyText,
}) {
  const hasActiveFilters = (filterValue?.dows?.length ?? 0) > 0 || filterValue?.daypart != null;

  const defaultEmpty = hasActiveFilters
    ? "Nessun orario con questi filtri. Prova a cambiare giorno o fascia, oppure scegli dal calendario."
    : "Nessun orario libero nel periodo prenotabile. Scegli una data dal calendario qui sotto.";

  return (
    <div className="bm-slotfinder">
      <div className="bm-slotfinder__filters">
        <p className="bm-slotfinder__heading">Quando preferisci venire?</p>
        <SlotFilters value={filterValue} onChange={onFilterChange} />
      </div>

      <div className="bm-slotfinder__divider" role="presentation" />

      <div className="bm-slotfinder__result" aria-live="polite">
        {loading ? (
          <p className="bm-slotfinder__result-loading">Cerco un orario…</p>
        ) : slot ? (
          <>
            <span className="bm-slotfinder__result-eyebrow">Prossimo disponibile</span>
            <span className="bm-slotfinder__result-value">{formatSlot(slot)}</span>
            {noMore && (
              <p className="bm-slotfinder__result-note">
                Non ci sono altri orari più avanti con questi filtri — scegli un'altra data dal calendario qui sotto.
              </p>
            )}
          </>
        ) : (
          <p className="bm-slotfinder__result-empty">{emptyText ?? defaultEmpty}</p>
        )}
      </div>

      <div className="bm-slotfinder__actions">
        <button
          type="button"
          className="bm-slotfinder__btn bm-slotfinder__btn--primary"
          onClick={() => slot && onBook(slot)}
          disabled={!slot}
        >
          Prenota questo orario
        </button>
        <button
          type="button"
          className="bm-slotfinder__btn bm-slotfinder__btn--secondary"
          onClick={onFindAnother}
          disabled={!slot || loading || noMore}
        >
          Cerca un altro orario
        </button>
      </div>
    </div>
  );
}
