/** Configurazione di tutti i tipi di badge ammessi. */
const BADGE_CONFIG = {
  new: { label: "Novità" },
  sale: { label: "Offerta" },
  promo: { label: "Promo" },
  limited: { label: "Limitato" },
  bestseller: { label: "Best Seller" },
  coming_soon: { label: "Coming Soon" },
};

/** Array ordinato dei tipi ammessi — utile per picker e validazione. */
export const BADGE_TYPES = Object.entries(BADGE_CONFIG).map(([type, { label }]) => ({
  type,
  label,
}));

// ─────────────────────────────────────────────────────────────
//  BadgeFlag — singola bandierina
// ─────────────────────────────────────────────────────────────

/**
 * Pennant orizzontale (76×24px) sul bordo destro; contenitore card con `position: relative`.
 *
 * @param {{ type: string }} props
 */
export function BadgeFlag({ type }) {
  const config = BADGE_CONFIG[type];
  if (!config) return null;
  return (
    <span className={`badge-flag badge-flag--${type}`} aria-label={config.label} title={config.label}>
      <span className="badge-flag__text">{config.label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
//  BadgeFlags — wrapper che renderizza più badge in colonna
// ─────────────────────────────────────────────────────────────

/** Massimo badge pennant visibili per card (evita sovraccarico). */
const MAX_BADGE_FLAGS = 2;

/**
 * Pennant orizzontali impilati sul bordo destro (`position: relative` sul contenitore card).
 * Non renderizza nulla se `badges` è null, undefined o vuoto.
 *
 * @param {{ badges: string[] }} props
 */
export function BadgeFlags({ badges }) {
  const list = badges?.filter(Boolean).slice(0, MAX_BADGE_FLAGS) ?? [];
  if (!list.length) return null;
  return (
    <div className="badge-flags" aria-hidden="true">
      {list.map((type, index) => (
        <BadgeFlag key={`${type}-${index}`} type={type} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BadgesPicker — griglia checkbox-pill per i form admin
// ─────────────────────────────────────────────────────────────

/**
 * Sezione "Etichette badge" da inserire nei form/drawer admin.
 *
 * @param {{ value: string[], onChange: (badges: string[]) => void }} props
 */
export function BadgesPicker({ value = [], onChange }) {
  const toggle = type => {
    const next = value.includes(type) ? value.filter(t => t !== type) : [...value, type];
    onChange(next);
  };

  return (
    <div className="badges-picker">
      <p className="badges-picker__label">Etichette badge</p>
      <div className="badges-picker__grid">
        {BADGE_TYPES.map(({ type, label }) => {
          const active = value.includes(type);
          return (
            <button
              key={type}
              type="button"
              className={`badges-picker__pill${active ? " badges-picker__pill--active" : ""}`}
              onClick={() => toggle(type)}
              aria-pressed={active}
            >
              {active && <span className="badges-picker__check">✓</span>}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
