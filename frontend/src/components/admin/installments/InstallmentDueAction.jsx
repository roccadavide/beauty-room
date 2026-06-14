import { formatEuro } from "../../../utils/formatEuro";

// Inline strip(s) rendered under an INSTALLMENTS package row in the agenda card, one
// per feed row for that package. A still-due rata shows the gold "in scadenza oggi"
// strip with [Salda] + [Posticipa]; a rata settled today stays visible as a green
// "saldata oggi" strip (no buttons) so the day still shows the money collected. An
// optional note is shown muted below either state. stopPropagation keeps the card's
// own row click (which opens the edit drawer) from firing when a button is pressed.
const stripBase = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: "0.82rem",
  fontWeight: 600,
};

export default function InstallmentDueAction({ dueRows, settling, onSettle, onPostpone }) {
  if (!dueRows?.length) return null;
  return (
    <>
      {dueRows.map(row => {
        const note = (row.note || "").trim();
        return (
          <div key={row.installmentId} style={{ margin: "2px 0 4px" }}>
            {row.paid ? (
              <div style={{ ...stripBase, background: "rgba(122,151,106,0.14)", border: "1px solid rgba(122,151,106,0.45)", color: "#4d6b3a" }}>
                <span>✅ Rata saldata oggi: {formatEuro(row.amount)}</span>
              </div>
            ) : (
              <div style={{ ...stripBase, background: "rgba(184,151,106,0.14)", border: "1px solid rgba(184,151,106,0.45)", color: "#6b4226" }}>
                <span>💶 Rata in scadenza oggi: {formatEuro(row.amount)}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="ag-pill ag-pill--toggle"
                    disabled={settling}
                    onClick={e => {
                      e.stopPropagation();
                      onSettle(row);
                    }}
                  >
                    Salda
                  </button>
                  <button
                    type="button"
                    className="ag-pill"
                    style={{ background: "transparent", color: "#8c6d3f", border: "1px solid rgba(184,151,106,0.6)" }}
                    disabled={settling}
                    onClick={e => {
                      e.stopPropagation();
                      onPostpone(row);
                    }}
                  >
                    Posticipa
                  </button>
                </span>
              </div>
            )}
            {note && <div style={{ fontSize: "0.76rem", color: "#8a7a64", padding: "2px 10px 0" }}>📝 nota: {note}</div>}
          </div>
        );
      })}
    </>
  );
}
