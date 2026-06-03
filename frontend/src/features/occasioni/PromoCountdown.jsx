import { useCountdown } from "../../hooks/useCountdown";

/**
 * Orologio a conto alla rovescia per una promo card.
 * Se mancano > 7 giorni: mostra solo giorni rimasti
 * Se mancano <= 7 giorni: mostra tutti e 4 i segmenti
 * Se scaduta: non renderizza nulla
 */
export default function PromoCountdown({ endDate }) {
  const r = useCountdown(endDate);
  if (!r || r.expired) return null;

  const urgent = r.days <= 7;
  const pad = n => String(n).padStart(2, "0");

  if (!urgent) {
    return (
      <div className="pc-wrap pc-wrap--calm">
        <span className="pc-days-only">Ancora {r.days} giorni</span>
      </div>
    );
  }

  return (
    <div className="pc-wrap">
      <span className="pc-label">Scade tra</span>
      <div className="pc-segments">
        {r.days > 0 && (
          <>
            <div className="pc-seg">
              <span className="pc-num">{pad(r.days)}</span>
              <span className="pc-unit">gg</span>
            </div>
            <span className="pc-colon">:</span>
          </>
        )}
        <div className="pc-seg">
          <span className="pc-num">{pad(r.hours)}</span>
          <span className="pc-unit">hh</span>
        </div>
        <span className="pc-colon">:</span>
        <div className="pc-seg">
          <span className="pc-num">{pad(r.minutes)}</span>
          <span className="pc-unit">mm</span>
        </div>
        <span className="pc-colon">:</span>
        <div className="pc-seg pc-seg--seconds">
          <span className="pc-num">{pad(r.seconds)}</span>
          <span className="pc-unit">ss</span>
        </div>
      </div>
    </div>
  );
}
