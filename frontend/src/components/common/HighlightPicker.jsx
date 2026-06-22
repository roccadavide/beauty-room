import { Form } from "react-bootstrap";
// Reuse the PostIt swatch/preview styles (.pib-color-picker / .pib-color-swatch /
// .pib-preview) instead of duplicating them. Importing the sheet here makes the
// classes available wherever the picker is mounted, not just on the PostIt page.
import "../../styles/pages/_postit.css";

// Same brand palette as PostItBoard (gold "Oro" first = the default highlight).
const PALETTE = [
  { hex: "#b8976a", name: "Oro" },
  { hex: "#8c6d3f", name: "Mogano" },
  { hex: "#d4a373", name: "Sabbia" },
  { hex: "#6d4c41", name: "Cacao" },
  { hex: "#5c7c5e", name: "Salvia" },
  { hex: "#7b6fa8", name: "Lavanda" },
  { hex: "#c0665e", name: "Rosa antico" },
  { hex: "#4a7fa5", name: "Petrolio" },
];

const DEFAULT_COLOR = "#b8976a";

// Translucent ring version of the chosen colour for the preview glow. Only a
// plain 6-digit hex can take the "40" alpha suffix; anything else (e.g. an
// 8-digit #RRGGBBAA from the backend) falls back to the solid colour.
const ring = (hex) => (/^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}40` : hex);

/**
 * Controlled toggle + colour picker for a card's "evidence border" highlight.
 * Holds no internal state — the parent form owns { enabled, color }.
 * Decoupled from ElectricBorder (Prompt B): the preview is a STATIC coloured
 * ring, not the animated border, so this component stays cheap.
 *
 * NOTE: deliberately NOT AdminToggle — that PATCHes immediately on click; here
 * the value must save together with the rest of the form.
 */
const HighlightPicker = ({ enabled, color, onEnabledChange, onColorChange }) => {
  const activeColor = color || DEFAULT_COLOR;

  return (
    <div className="d-flex flex-column gap-2">
      <Form.Check
        type="switch"
        id="highlight-enabled"
        label="Bordo in evidenza"
        checked={!!enabled}
        onChange={(e) => {
          const on = e.target.checked;
          onEnabledChange(on);
          // Seed the brand gold on first enable so the swatch row and preview
          // never render against an empty colour.
          if (on && !color) onColorChange(DEFAULT_COLOR);
        }}
      />

      {enabled && (
        <>
          <div className="pib-color-picker">
            {PALETTE.map((c) => (
              <button
                key={c.hex}
                type="button"
                className={`pib-color-swatch${activeColor === c.hex ? " active" : ""}`}
                style={{ background: c.hex }}
                title={c.name}
                onClick={() => onColorChange(c.hex)}
              />
            ))}
          </div>

          <Form.Group>
            <Form.Label className="small mb-1">Personalizzato</Form.Label>
            <Form.Control
              type="color"
              value={activeColor}
              onChange={(e) => onColorChange(e.target.value)}
              title="Colore personalizzato"
              style={{ width: 56, height: 34, padding: 2 }}
            />
          </Form.Group>

          <div
            className="pib-preview d-flex align-items-center"
            style={{
              "--note-color": activeColor,
              padding: "0.85rem 1rem",
              border: `2px solid ${activeColor}`,
              boxShadow: `0 0 0 4px ${ring(activeColor)}, 0 4px 16px ${ring(activeColor)}`,
            }}
          >
            <span className="small" style={{ color: "var(--bm-text-secondary, #666)" }}>
              Anteprima bordo in evidenza
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default HighlightPicker;
