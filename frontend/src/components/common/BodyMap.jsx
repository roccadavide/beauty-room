import "./BodyMap.css";

/**
 * BodyMap — silhouette reattiva (fronte + retro) per Epilazione laser / a cera.
 *
 * Props:
 *   selectedRegions : string[]  // region ids attualmente SELEZIONATI (oro)
 *   inCartRegions   : string[]  // region ids già NEL CARRELLO (verde)
 *
 * Le regioni che stanno su entrambi i lati (braccia, gambe, spalle) hanno lo
 * stesso id sul fronte e sul retro: passando l'id si illuminano su entrambe le
 * figure automaticamente. La mappa zona→regioni vive in zoneRegions.js.
 */

const BodyBase = () => (
  <g className="bm-body">
    <ellipse cx="100" cy="46" rx="26" ry="29" />
    <rect x="91" y="71" width="18" height="16" rx="7" />
    <path d="M70,92 Q63,150 82,196 Q85,224 78,250 L122,250 Q115,224 118,196 Q137,150 130,92 Q100,76 70,92 Z" />
    <rect x="54" y="96" width="16" height="150" rx="8" />
    <rect x="130" y="96" width="16" height="150" rx="8" />
    <ellipse cx="62" cy="250" rx="9" ry="11" />
    <ellipse cx="138" cy="250" rx="9" ry="11" />
    <rect x="80" y="244" width="18" height="240" rx="9" />
    <rect x="102" y="244" width="18" height="240" rx="9" />
    <ellipse cx="84" cy="488" rx="11" ry="7" />
    <ellipse cx="118" cy="488" rx="11" ry="7" />
  </g>
);

export default function BodyMap({ selectedRegions = [], inCartRegions = [] }) {
  const sel = new Set(selectedRegions);
  const cart = new Set(inCartRegions);
  const c = id => (sel.has(id) ? "bm-region bm-region--sel" : cart.has(id) ? "bm-region bm-region--cart" : "bm-region");

  return (
    <div className="bm-figs" aria-hidden="true">
      <div className="bm-stack">
        <svg className="bm-fig" viewBox="0 0 200 500" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bmBodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#efe1cd" />
              <stop offset="1" stopColor="#e4d2b6" />
            </linearGradient>
          </defs>
          <BodyBase />
          <g className="bm-regions">
            <rect className={c("sopracciglia")} x="88" y="35" width="24" height="5" rx="2.5" />
            <rect className={c("baffetto")} x="91" y="49" width="18" height="5" rx="2.5" />
            <ellipse className={c("mento")} cx="100" cy="62" rx="8" ry="5.5" />
            <rect className={c("collo")} x="93" y="72" width="14" height="13" rx="5" />
            <ellipse className={c("spalle")} cx="76" cy="95" rx="13" ry="9" />
            <ellipse className={c("spalle")} cx="124" cy="95" rx="13" ry="9" />
            <ellipse className={c("ascella-l")} cx="71" cy="105" rx="6" ry="9" />
            <ellipse className={c("ascella-r")} cx="129" cy="105" rx="6" ry="9" />
            <rect className={c("petto")} x="76" y="100" width="48" height="48" rx="14" />
            <rect className={c("addome")} x="80" y="150" width="40" height="44" rx="12" />
            <rect className={c("linea-alba")} x="98" y="150" width="4" height="44" rx="2" />
            <rect className={c("braccio-l")} x="54" y="98" width="16" height="148" rx="8" />
            <rect className={c("braccio-r")} x="130" y="98" width="16" height="148" rx="8" />
            <path className={c("inguine")} d="M82,196 H118 V206 Q100,230 82,206 Z" />
            <rect className={c("coscia-l")} x="80" y="246" width="18" height="118" rx="9" />
            <rect className={c("coscia-r")} x="102" y="246" width="18" height="118" rx="9" />
            <rect className={c("polpaccio-l")} x="80" y="366" width="18" height="116" rx="9" />
            <rect className={c("polpaccio-r")} x="102" y="366" width="18" height="116" rx="9" />
          </g>
        </svg>
        <span className="bm-caption">Fronte</span>
      </div>

      <div className="bm-stack">
        <svg className="bm-fig" viewBox="0 0 200 500" xmlns="http://www.w3.org/2000/svg">
          <BodyBase />
          <g className="bm-regions">
            <ellipse className={c("spalle")} cx="76" cy="95" rx="13" ry="9" />
            <ellipse className={c("spalle")} cx="124" cy="95" rx="13" ry="9" />
            <rect className={c("braccio-l")} x="54" y="98" width="16" height="148" rx="8" />
            <rect className={c("braccio-r")} x="130" y="98" width="16" height="148" rx="8" />
            <rect className={c("schiena-alta")} x="76" y="98" width="48" height="68" rx="14" />
            <rect className={c("lombare")} x="80" y="168" width="40" height="34" rx="11" />
            <path className={c("glutei")} d="M78,202 Q78,196 100,196 Q122,196 122,202 L122,232 Q122,248 100,248 Q78,248 78,232 Z" />
            <rect className={c("coscia-l")} x="80" y="246" width="18" height="118" rx="9" />
            <rect className={c("coscia-r")} x="102" y="246" width="18" height="118" rx="9" />
            <rect className={c("polpaccio-l")} x="80" y="366" width="18" height="116" rx="9" />
            <rect className={c("polpaccio-r")} x="102" y="366" width="18" height="116" rx="9" />
          </g>
        </svg>
        <span className="bm-caption">Retro</span>
      </div>
    </div>
  );
}
