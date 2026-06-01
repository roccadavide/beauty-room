import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";

/**
 * Completion drawer for the agenda "Completa" button (per-line settle path).
 *
 * Pure component: receives the already-built breakdown `items` from the parent
 * (AdminAgendaPage.buildBreakdownItems) so it never recomputes prices itself.
 * Each item carries { label, price, paid, refKind, refId, locked } — refKind/refId
 * map a toggle to the /settle payload (servicePaid by catalog service id,
 * packageSessionPaid by ClientPackageAssignment id, customServicePaid for the
 * free-form line).
 *
 * Two modes:
 *  - normal (customTotalPrice == null): per-line paid toggles + bulk "Pagato tutto".
 *  - bundle (customTotalPrice != null): ONE atomic toggle "Pagato in totale (€X)".
 *    The backend enforces lockstep; we still send a coherent markAllPaid.
 *
 * Reuses existing agenda CSS only (ag-estimato-*, ag-pill*, ag-btn*). No new CSS.
 */
export default function CompletionDrawer({ booking, items, onClose, onConfirm }) {
  const isBundle = booking.customTotalPrice != null;

  // Per-row paid state, aligned by index to `items`. Locked rows stay true.
  const [rowsPaid, setRowsPaid] = useState(() => items.map(it => it.locked ? true : it.paid === true));
  // Bundle: defensive init — empty items must NOT default to "paid".
  const [bundlePaid, setBundlePaid] = useState(() => items.length > 0 && items.every(it => it.paid));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const bundleTotal = useMemo(
    () => (isBundle ? Number(booking.customTotalPrice) : 0),
    [isBundle, booking.customTotalPrice],
  );

  const toggleRow = idx =>
    setRowsPaid(prev => prev.map((v, i) => (i === idx ? !v : v)));

  const markAll = () => setRowsPaid(items.map(() => true));

  const buildNormalPayload = () => {
    const servicePaid = {};
    const packageSessionPaid = {};
    let customServicePaid;
    items.forEach((it, idx) => {
      if (it.locked) return; // upfront-paid package etc.: backend ignores it
      const paid = rowsPaid[idx];
      if (it.refKind === "service" || it.refKind === "legacy") {
        if (it.refId != null) servicePaid[String(it.refId)] = paid;
      } else if (it.refKind === "package") {
        if (it.refId != null) packageSessionPaid[String(it.refId)] = paid;
      } else if (it.refKind === "custom") {
        customServicePaid = paid;
      }
    });
    const payload = { servicePaid, packageSessionPaid, alsoComplete: true };
    if (customServicePaid !== undefined) payload.customServicePaid = customServicePaid;
    return payload;
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const payload = isBundle
        ? { markAllPaid: bundlePaid, alsoComplete: true }
        : buildNormalPayload();
      await onConfirm(payload);
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="ag-estimato-backdrop" onClick={onClose}>
      <div className="ag-estimato-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Completa appuntamento">
        <div className="ag-estimato-header">
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Completa appuntamento</h3>
          <button className="ag-estimato-close" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div className="ag-estimato-body">
          {isBundle ? (
            <table className="ag-estimato-table">
              <tbody>
                <tr>
                  <td>{booking.customServiceName || "Pacchetto"}</td>
                  <td className="ag-estimato-price">€{bundleTotal.toFixed(0)}</td>
                  <td>
                    <button
                      type="button"
                      className={`ag-pill ag-pill--toggle ${bundlePaid ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                      onClick={() => setBundlePaid(v => !v)}
                    >
                      {bundlePaid ? `✓ Pagato in totale (€${bundleTotal.toFixed(0)})` : `⏳ Pagato in totale (€${bundleTotal.toFixed(0)})`}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="ag-estimato-table">
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className={rowsPaid[idx] ? "ag-estimato-row--paid" : ""}>
                    <td>
                      <span style={rowsPaid[idx] ? { textDecoration: "line-through", opacity: 0.55 } : undefined}>{it.label}</span>
                    </td>
                    <td className={`ag-estimato-price${it.price == null ? " ag-estimato-price--null" : ""}`}>
                      {it.price == null ? "—" : `€${Number(it.price).toFixed(0)}`}
                    </td>
                    <td>
                      {it.locked ? (
                        <span className="ag-pill ag-pill--paid" aria-disabled="true" title="Pagato in anticipo">
                          🔒 Già pagato
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`ag-pill ag-pill--toggle ${rowsPaid[idx] ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                          onClick={() => toggleRow(idx)}
                          title={rowsPaid[idx] ? "Segna come da pagare" : "Segna come pagato"}
                        >
                          {rowsPaid[idx] ? "✓ Pagato" : "⏳ Da pagare"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="ag-estimato-footer" style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          {!isBundle && (
            <button type="button" className="ag-btn ag-btn--soft" onClick={markAll} disabled={saving}>
              Pagato tutto
            </button>
          )}
          <button type="button" className="ag-btn ag-btn--ok" onClick={handleConfirm} disabled={saving}>
            {saving ? "…" : "Completa appuntamento"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
