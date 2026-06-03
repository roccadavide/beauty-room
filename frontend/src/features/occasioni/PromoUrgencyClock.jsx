const HOT_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/**
 * Decorative urgency clock. The hand stops on each quarter (12/3/6/9) and
 * bounces on arrival (pure-CSS animation in _occasioni.css). Tier auto-derived
 * from time left: "hot" (amber, faster) when <= 48h, else "calm" (gold, slower).
 * Renders nothing if there's no endDate or it's already past.
 *
 * @param {{ endDate?: string }} props
 */
export default function PromoUrgencyClock({ endDate }) {
  if (!endDate) return null;
  const msLeft = new Date(endDate).getTime() - Date.now();
  if (Number.isNaN(msLeft) || msLeft <= 0) return null;
  const tier = msLeft <= HOT_THRESHOLD_MS ? "hot" : "calm";
  return (
    <svg className={`puc-clock puc-clock--${tier}`} viewBox="0 0 48 48" aria-hidden="true">
      <circle className="puc-ring" cx="24" cy="24" r="19" />
      <line className="puc-tick" x1="24" y1="6" x2="24" y2="9.5" />
      <line className="puc-tick" x1="42" y1="24" x2="38.5" y2="24" />
      <line className="puc-tick" x1="24" y1="42" x2="24" y2="38.5" />
      <line className="puc-tick" x1="6" y1="24" x2="9.5" y2="24" />
      <g className="puc-rot">
        <line className="puc-hand" x1="24" y1="24" x2="24" y2="7.5" />
      </g>
      <circle className="puc-hub" cx="24" cy="24" r="2.3" />
    </svg>
  );
}
