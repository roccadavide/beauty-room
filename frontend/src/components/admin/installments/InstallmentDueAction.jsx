import { formatEuro } from "../../../utils/formatEuro";

// Inline gold "rata due today" strip rendered under a package row in the agenda card.
// Renders nothing when no rata is due (quiet). stopPropagation keeps the surrounding
// card's row click (which opens the edit drawer) from firing when "Salda" is pressed.
export default function InstallmentDueAction({ dueRows, settling, onSettle }) {
  if (!dueRows?.length) return null;
  return (
    <>
      {dueRows.map(row => (
        <div
          key={row.installmentId}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            margin: "2px 0 4px",
            padding: "6px 10px",
            background: "rgba(184,151,106,0.14)",
            border: "1px solid rgba(184,151,106,0.45)",
            borderRadius: 8,
            color: "#6b4226",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          <span>💶 Rata in scadenza oggi: {formatEuro(row.amount)}</span>
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
        </div>
      ))}
    </>
  );
}
