import "./LikePill.css";

const HeartIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" className={`lp-icon${filled ? " lp-icon--filled" : ""}`} aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

/**
 * LikePill — presentational.
 * Stato gestito dal chiamante tramite useLike.
 *
 * @param {number}   count    - contatore corrente
 * @param {boolean}  liked    - true se l'utente ha già messo like
 * @param {function} onClick  - callback (triggerLike)
 * @param {boolean}  [hint]   - mostra pulse hint al primo utilizzo
 * @param {boolean}  [compact]- variante ridotta per le card
 */
export default function LikePill({ count, liked, onClick, hint = false, compact = false }) {
  return (
    <button
      className={`lp-pill${liked ? " lp-pill--liked" : ""}${hint ? " lp-pill--hint" : ""}${compact ? " lp-pill--compact" : ""}`}
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      aria-label={liked ? "Hai messo like" : "Metti like"}
      aria-pressed={liked}
    >
      <span className="lp-icon-wrap">
        <HeartIcon filled={liked} />
      </span>
      <span className="lp-count">{count}</span>
    </button>
  );
}
