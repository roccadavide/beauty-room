import { useEffect, useState } from "react";
import { fetchCustomerInsights } from "../../../api/modules/customer.api";
import "./ClientsQuickPicks.css";

// Initials from a full name (first two words) — mirrors the cdp/agenda avatar.
function initialsFromName(name) {
  return (
    (name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join("") || "?"
  );
}

/**
 * Empty-state quick shortcuts for the Clienti tab. The hub mounts this IN PLACE
 * of the detail panel when no customer is selected, so the single
 * fetchCustomerInsights() here fires only when the empty state actually renders.
 * Surfaces a handful of rows that carry a real customerId (most appointments /
 * top spend / win-back), each tappable → onPick(customerId). On failure or no
 * clickable rows it degrades to a clean "cerca un cliente" prompt.
 */
export default function ClientsQuickPicks({ onPick }) {
  const [rows, setRows] = useState(null); // null = loading, [] = none / failed

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchCustomerInsights();
        if (cancelled) return;
        const picks = [];
        const seen = new Set();
        const push = (r, reason) => {
          if (!r || r.customerId == null || seen.has(r.customerId)) return;
          seen.add(r.customerId);
          picks.push({ id: r.customerId, name: r.name, reason });
        };
        (d.topByCompletedAppointments || []).forEach(r => push(r, `${r.count} appuntamenti`));
        (d.topBySpend || []).forEach(r => push(r, r.visits != null ? `${r.visits} visite` : "Tra le più spese"));
        (d.winBack || []).forEach(r => push(r, "Da risentire"));
        setRows(picks.slice(0, 6));
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null) {
    return (
      <div className="cqp cqp--loading" aria-hidden="true">
        <span className="cqp-sk" />
        <span className="cqp-sk" />
        <span className="cqp-sk" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="cqp-prompt">Cerca una cliente per nome, telefono o email.</div>;
  }

  return (
    <div className="cqp">
      <div className="cqp__head">
        <h3 className="cqp__title">Accesso rapido</h3>
        <span className="cqp__hint">Cerca sopra o tocca una cliente</span>
      </div>
      <div className="cqp__grid">
        {rows.map(r => (
          <button key={r.id} type="button" className="cqp-card" onClick={() => onPick(r.id)}>
            <span className="cqp-avatar" aria-hidden="true">{initialsFromName(r.name)}</span>
            <span className="cqp-id">
              <span className="cqp-name">{r.name || "—"}</span>
              <span className="cqp-reason">{r.reason}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
