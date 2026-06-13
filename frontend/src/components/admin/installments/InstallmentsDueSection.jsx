import { formatEuro } from "../../../utils/formatEuro";

// "Rate in scadenza oggi" block for the EstimatoModal — lists every due rata across
// all clients, including those with no appointment today (who never appear in the
// bookings table), so the KPI total is auditable. Renders nothing when none are due.
export default function InstallmentsDueSection({ dueList, settling, onSettle }) {
  if (!dueList?.length) return null;
  return (
    <div
      style={{
        margin: "1rem 0 0",
        padding: "0.75rem 1rem",
        background: "rgba(184,151,106,0.10)",
        border: "1px solid rgba(184,151,106,0.4)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#6b4226", marginBottom: 8 }}>
        📅 Rate in scadenza oggi
      </div>
      {dueList.map(row => (
        <div
          key={row.installmentId}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 0" }}
        >
          <span style={{ fontSize: "0.86rem", color: "#5a4632" }}>
            {row.clientName} · {row.packageName} — {formatEuro(row.amount)}
            {row.remaining != null && <span style={{ opacity: 0.75 }}> · residuo {formatEuro(row.remaining)}</span>}
          </span>
          <button type="button" className="ag-pill ag-pill--toggle" disabled={settling} onClick={() => onSettle(row)}>
            Salda
          </button>
        </div>
      ))}
    </div>
  );
}
