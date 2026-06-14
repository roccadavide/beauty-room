import { formatEuro } from "../../../utils/formatEuro";

// "Rate del giorno" block for the EstimatoModal — lists every installment touching the
// viewed day (still-due AND settled-today) across all clients, including those with no
// appointment today (who never appear in the bookings table), so the KPI total is
// auditable. A settled rata shows "saldato"; an unpaid one offers Salda/Posticipa. The
// section total sums ALL rows so it matches the KPI (settled-today included). Renders
// nothing when none.
export default function InstallmentsDueSection({ dueList, settling, onSettle, onPostpone }) {
  if (!dueList?.length) return null;
  const total = dueList.reduce((acc, r) => acc + Number(r.amount || 0), 0);
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
      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#6b4226", marginBottom: 8 }}>📅 Rate del giorno</div>
      {dueList.map(row => {
        const note = (row.note || "").trim();
        return (
          <div key={row.installmentId} style={{ padding: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "0.86rem", color: "#5a4632" }}>
                {row.clientName} · {row.packageName} — {formatEuro(row.amount)}
              </span>
              {row.paid ? (
                <span className="ag-pill ag-pill--paid">✅ saldato</span>
              ) : (
                <span style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="ag-pill ag-pill--toggle" disabled={settling} onClick={() => onSettle(row)}>
                    Salda
                  </button>
                  <button
                    type="button"
                    className="ag-pill"
                    style={{ background: "transparent", color: "#8c6d3f", border: "1px solid rgba(184,151,106,0.6)" }}
                    disabled={settling}
                    onClick={() => onPostpone(row)}
                  >
                    Posticipa
                  </button>
                </span>
              )}
            </div>
            {note && <div style={{ fontSize: "0.78rem", color: "#8a7a64", paddingTop: 2 }}>📝 nota: {note}</div>}
          </div>
        );
      })}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          paddingTop: 6,
          borderTop: "1px solid rgba(184,151,106,0.3)",
          fontWeight: 700,
          color: "#6b4226",
          fontSize: "0.86rem",
        }}
      >
        <span>Totale rate del giorno</span>
        <span>{formatEuro(total)}</span>
      </div>
    </div>
  );
}
