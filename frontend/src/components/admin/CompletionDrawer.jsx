import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { pushLenisLock, popLenisLock } from "../../hooks/useLenis";
import { applySettleLine } from "./settlePayload";

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
  // Bundle: defensive init — empty items must NOT default to "paid". Products (kind
  // "sale") aren't part of the bundle price (they're settled in the drawer / arretrati),
  // so the bundle's paid state reflects the non-sale lines only.
  const [bundlePaid, setBundlePaid] = useState(() => {
    const nonSale = items.filter(it => it.kind !== "sale");
    return nonSale.length > 0 && nonSale.every(it => it.paid);
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Stop background (Lenis) scroll while open; ref-counted so it's balanced even on
  // abrupt unmount (e.g. route change). The cleanup always runs on unmount.
  useEffect(() => {
    pushLenisLock();
    return () => popLenisLock();
  }, []);

  const bundleTotal = useMemo(
    () => (isBundle ? Number(booking.customTotalPrice) : 0),
    [isBundle, booking.customTotalPrice],
  );

  const toggleRow = idx =>
    setRowsPaid(prev => prev.map((v, i) => (i === idx ? !v : v)));

  const markAll = () => setRowsPaid(items.map(() => true));

  const buildNormalPayload = () => {
    // servicePaid/packageSessionPaid pre-initialised so a bundle-less appointment
    // always sends the (possibly empty) maps, exactly as before. The per-line
    // kind→key mapping lives in the shared applySettleLine (also used by the
    // ClientiPage arretrati panel) — customServicePaid is only added when a custom
    // line is present, matching the previous behavior.
    const payload = { servicePaid: {}, packageSessionPaid: {}, promotionPaid: {}, salePaid: {}, alsoComplete: true };
    items.forEach((it, idx) => {
      if (it.locked) return; // upfront-paid package etc.: backend ignores it
      applySettleLine(payload, it.refKind, it.refId, rowsPaid[idx]);
    });
    return payload;
  };

  // Bundle: the atomic toggle settles the services bundle (markAllPaid); products are
  // settled individually via salePaid, exactly like the non-bundle path — products are
  // never part of the manual bundle price (see computeBookingAmountDue).
  const buildBundlePayload = () => {
    const payload = { markAllPaid: bundlePaid, alsoComplete: true };
    items.forEach((it, idx) => {
      if (it.kind === "sale" && it.refId != null) {
        if (!payload.salePaid) payload.salePaid = {};
        payload.salePaid[String(it.refId)] = rowsPaid[idx];
      }
    });
    return payload;
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const payload = isBundle ? buildBundlePayload() : buildNormalPayload();
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

        <div className="ag-estimato-body" data-lenis-prevent>
          {isBundle ? (
            // Bundle = prezzo unico atomico. Le righe sono SOLO informative (cosa
            // include l'appuntamento), prezzo attenuato (.ag-muted), nessun toggle per
            // riga. Il pagamento è un unico toggle sul totale (all-or-nothing). La riga
            // di spiegazione chiarisce perché il totale ≠ somma delle righe.
            <>
              <table className="ag-estimato-table">
                <tbody>
                  {items.filter(it => it.kind !== "sale").map((it, idx) => (
                    <tr key={idx}>
                      <td><span className="ag-muted">{it.label}</span></td>
                      <td className={`ag-estimato-price ag-muted${it.price == null ? " ag-estimato-price--null" : ""}`}>
                        {it.price == null ? "—" : `€${Number(it.price).toFixed(0)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ padding: "0.75rem 1rem 0", margin: 0, fontSize: "0.85rem" }}>
                <strong>Prezzo totale concordato: €{bundleTotal.toFixed(0)}</strong>
                <span className="ag-muted"> — impostato manualmente. I prezzi per riga sopra sono solo indicativi.</span>
              </p>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className={`ag-pill ag-pill--toggle ${bundlePaid ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                  onClick={() => setBundlePaid(v => !v)}
                >
                  {bundlePaid ? "✓ Pagato in totale" : "⏳ Pagato in totale"}
                </button>
              </div>
              {/* Products are NOT part of the manual bundle price — settle them
                  individually here so a bundle appointment is completed in one place
                  (otherwise an unpaid product would silently land in arretrati). */}
              {items.some(it => it.kind === "sale") && (
                <>
                  <p style={{ padding: "0.75rem 1rem 0.25rem", margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "#8c6d3f" }}>
                    🛍️ Prodotti (a parte)
                  </p>
                  <table className="ag-estimato-table">
                    <tbody>
                      {items.map((it, idx) =>
                        it.kind === "sale" ? (
                          <tr key={idx} className={rowsPaid[idx] ? "ag-estimato-row--paid" : ""}>
                            <td>
                              <span style={rowsPaid[idx] ? { textDecoration: "line-through", opacity: 0.55 } : undefined}>{it.label}</span>
                            </td>
                            <td className={`ag-estimato-price${it.price == null ? " ag-estimato-price--null" : ""}`}>
                              {it.price == null ? "—" : `€${Number(it.price).toFixed(0)}`}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`ag-pill ag-pill--toggle ${rowsPaid[idx] ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                                onClick={() => toggleRow(idx)}
                                title={rowsPaid[idx] ? "Segna come da pagare" : "Segna come pagato"}
                              >
                                {rowsPaid[idx] ? "✓ Pagato" : "⏳ Da pagare"}
                              </button>
                            </td>
                          </tr>
                        ) : null,
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </>
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
