function CalIcon() {
  return (
    <svg className="nsb__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function formatDate(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * NextSlotBanner — mostra il prossimo slot disponibile per un servizio.
 *
 * Props:
 *   slot      { date, startTime, endTime } | null
 *   loading   boolean
 *   notFound  boolean  — true se la ricerca ha prodotto 404
 *   onFind    () => void  — chiamato per avviare la ricerca
 *   onNext    () => void  — "Cerca un altro orario"
 *   onSelect  (slot) => void  — quando il cliente accetta lo slot
 */
export default function NextSlotBanner({ slot, loading, notFound, onFind, onNext, onSelect }) {
  if (loading) {
    return (
      <div className="nsb nsb--skeleton">
        <div className="nsb__top">
          <CalIcon />
          <div className="nsb__body">
            <div className="nsb-skel nsb-skel--label" />
            <div className="nsb-skel nsb-skel--date" />
            <div className="nsb-skel nsb-skel--time" />
          </div>
          <div className="nsb-skel nsb-skel--btn" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="nsb">
        <div className="nsb__top">
          <CalIcon />
          <p className="nsb__empty">Nessun orario disponibile nei prossimi 60 giorni.</p>
        </div>
      </div>
    );
  }

  if (!slot) return null;

  return (
    <div className="nsb">
      <div className="nsb__top">
        <CalIcon />
        <div className="nsb__body">
          <span className="nsb__label">Prossimo disponibile</span>
          <span className="nsb__date">{formatDate(slot.date)}</span>
          <span className="nsb__time">
            ore {slot.startTime} – {slot.endTime}
          </span>
        </div>
        <button className="nsb__cta" type="button" onClick={() => onSelect(slot)}>
          Prenota questo
        </button>
      </div>
      <button className="nsb__next" type="button" onClick={onNext}>
        Cerca un altro orario →
      </button>
    </div>
  );
}
