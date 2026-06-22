import ElectricBorder from "./ElectricBorder";
import "./CardGlow.css";

// Editorial Beauty tuning — a soft, slow, thin gold "breathing" outline (not neon).
// Tune these four numbers here, once, for every highlighted card on the site.
const GLOW = { thickness: 1.6, speed: 0.8, chaos: 0.13 };
const DEFAULT_COLOR = "#b8976a"; // brand gold — used when a card has no explicit colour

/**
 * Wraps a public card in the animated ElectricBorder when `enabled`.
 * When disabled it returns children untouched: no wrapper element, no rAF, no
 * layout change. Centralises the tuning, the gold fallback, and the flex-fill
 * class so the wrapper stretches exactly like the bare card did in its <Col>.
 */
const CardGlow = ({ enabled, color, radius = 20, children }) => {
  if (!enabled) return children;
  return (
    <ElectricBorder
      className="eb-card-fill"
      color={color || DEFAULT_COLOR}
      borderRadius={radius}
      thickness={GLOW.thickness}
      speed={GLOW.speed}
      chaos={GLOW.chaos}
    >
      {children}
    </ElectricBorder>
  );
};

export default CardGlow;
