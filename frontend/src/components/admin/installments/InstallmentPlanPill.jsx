import { formatEuro } from "../../../utils/formatEuro";

// Always-on "payment plan" pill for packages billed in installments. Reads the
// batched per-package SUMMARY (not the due-feed rows), so it shows "Pagato €X su €Y
// totali" on every INSTALLMENTS card regardless of whether a rata falls due that day,
// and "✓ Già pagato" once fully settled. Never the paid/unpaid pill (per-session price
// is €0, so "✓ Pagato"/"⏳ Da pagare" would be misleading). Pure, no state.
export default function InstallmentPlanPill({ summary }) {
  if (summary?.fullyPaid) {
    return (
      <span
        className="ag-pill"
        style={{ background: "rgba(140,109,63,0.14)", color: "#6f5630", border: "1px solid rgba(140,109,63,0.55)" }}
        title="Pacchetto saldato"
      >
        ✓ Già pagato
      </span>
    );
  }
  return (
    <span
      className="ag-pill"
      style={{ background: "rgba(184,151,106,0.12)", color: "#8c6d3f", border: "1px solid rgba(184,151,106,0.5)" }}
      title="Pagamento a rate"
    >
      📅 Piano rate
      {summary && (
        <>
          {" · Pagato "}
          {formatEuro(summary.collected)} su {formatEuro(summary.total)} totali
        </>
      )}
    </span>
  );
}
