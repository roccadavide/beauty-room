import { formatEuro } from "../../../utils/formatEuro";

// Neutral "payment plan" pill for packages billed in installments — never the
// paid/unpaid pill (per-session price is €0, so "✓ Pagato"/"⏳ Da pagare" would be
// misleading). When a rata falls due on the viewed day, the live residuo/total is
// appended. Pure, no state.
export default function InstallmentPlanPill({ dueRows }) {
  const due = dueRows?.length ? dueRows[0] : null;
  return (
    <span
      className="ag-pill"
      style={{ background: "rgba(184,151,106,0.12)", color: "#8c6d3f", border: "1px solid rgba(184,151,106,0.5)" }}
      title="Pagamento a rate"
    >
      📅 Piano rate
      {due && (
        <>
          {" · residuo "}
          {formatEuro(due.remaining)} di {formatEuro(due.total)}
        </>
      )}
    </span>
  );
}
