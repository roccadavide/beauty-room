import { formatEuro } from "../../../utils/formatEuro";

// Always-on "payment plan" pill for packages billed in installments. Reads the
// batched per-package SUMMARY (not the due-feed rows), so it shows "Pagato €X su €Y
// totali" on every INSTALLMENTS card regardless of whether a rata falls due that day,
// and "✓ Già pagato" once fully settled. Never the paid/unpaid pill (per-session price
// is €0, so "✓ Pagato"/"⏳ Da pagare" would be misleading).
//
// `onClick` (optional): when provided the pill renders as a real <button> — so it's
// keyboard-activatable and picks up the shared `button.ag-pill` cursor + hover — and
// stops propagation so the card's own row click doesn't also fire. Without it the pill
// renders as a plain, non-interactive <span> exactly as before.
export default function InstallmentPlanPill({ summary, onClick }) {
  const fullyPaid = !!summary?.fullyPaid;
  const palette = fullyPaid
    ? { background: "rgba(140,109,63,0.14)", color: "#6f5630", border: "1px solid rgba(140,109,63,0.55)" }
    : { background: "rgba(184,151,106,0.12)", color: "#8c6d3f", border: "1px solid rgba(184,151,106,0.5)" };
  const title = fullyPaid ? "Pacchetto saldato" : "Pagamento a rate";
  const content = fullyPaid ? (
    "✓ Già pagato"
  ) : (
    <>
      📅 Piano rate
      {summary && (
        <>
          {" · Pagato "}
          {formatEuro(summary.collected)} su {formatEuro(summary.total)} totali
        </>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="ag-pill"
        style={palette}
        title={title}
        onClick={e => {
          e.stopPropagation();
          onClick(e);
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <span className="ag-pill" style={palette} title={title}>
      {content}
    </span>
  );
}
