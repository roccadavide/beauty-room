import ReactDOM from "react-dom";
import { useState } from "react";
import { updatePackageAssignment } from "../../api/modules/adminAgenda.api";

/**
 * Shared modal for editing a ClientPackageAssignment.
 * Uses .ep-* CSS classes defined in _clienti.css (globally imported).
 *
 * Props:
 *   pkg      — ClientPackageAssignmentDTO object
 *   services — catalog services array for price pre-fill (optional)
 *   onClose  — called to dismiss without saving
 *   onSave   — called with the updated DTO after successful save
 */
export default function EditPackageModal({ pkg, services = [], onClose, onSave }) {
  const completedSessions = pkg.totalSessions - pkg.sessionsRemaining;

  // Compute the catalog default for pricePaid — runs only at mount.
  const defaultPricePaid = (() => {
    if (pkg.pricePaid != null && Number(pkg.pricePaid) > 0) return pkg.pricePaid;
    let unitPrice = null;
    if (pkg.serviceOptionId) {
      for (const svc of services) {
        const opts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
        const opt = opts.find(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId));
        if (opt?.price != null) {
          unitPrice = Number(opt.price);
          break;
        }
      }
    }
    if (unitPrice == null && pkg.serviceId) {
      const svc = services.find(s => String(s.serviceId) === String(pkg.serviceId));
      if (svc?.price != null) unitPrice = Number(svc.price);
    }
    if (unitPrice == null || !pkg.totalSessions) return "";
    return (unitPrice * pkg.totalSessions).toFixed(2);
  })();

  const [form, setForm] = useState({
    totalSessions: pkg.totalSessions,
    pricePaid: pkg.pricePaid != null && Number(pkg.pricePaid) > 0 ? pkg.pricePaid : defaultPricePaid,
    notes: pkg.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async e => {
    e.preventDefault();
    const total = Number(form.totalSessions);
    if (total < completedSessions) {
      setError(`Le sedute totali non possono essere inferiori alle ${completedSessions} sedute già effettuate.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        clientName: pkg.clientName,
        serviceOptionId: pkg.serviceOptionId ?? null,
        customPackageName: pkg.customPackageName ?? null,
        totalSessions: total,
        sessionsRemaining: null,
        pricePaid: form.pricePaid !== "" ? form.pricePaid : null,
        notes: form.notes || null,
        linkedUserId: pkg.linkedUserId ?? null,
      };
      const updated = await updatePackageAssignment(pkg.id, payload);
      onSave(updated);
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="ep-backdrop" onClick={onClose}>
      <div className="ep-modal" onClick={e => e.stopPropagation()}>
        <div className="ep-header">
          <div className="ep-title">Modifica pacchetto</div>
          <button className="ep-close" onClick={onClose} type="button">✕</button>
        </div>
        <div className="ep-pkg-name">{pkg.displayName || pkg.serviceOptionName || "Pacchetto"}</div>
        <form onSubmit={handleSubmit} className="ep-form">
          <label className="ep-label">
            Sedute totali
            <input
              className="ep-input"
              type="number"
              min={Math.max(1, completedSessions)}
              value={form.totalSessions}
              onChange={e => setForm(f => ({ ...f, totalSessions: e.target.value }))}
              required
            />
          </label>
          {completedSessions > 0 && (
            <div className="ep-sessions-hint">
              {completedSessions} {completedSessions === 1 ? "seduta già effettuata" : "sedute già effettuate"} — minimo {completedSessions}
            </div>
          )}
          <div style={{
            padding: "8px 12px",
            background: "rgba(184, 151, 106, 0.08)",
            borderLeft: "3px solid #b8976a",
            borderRadius: "0 6px 6px 0",
            fontSize: "0.88rem",
            marginBottom: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}>
            <span>Sedute rimanenti: <strong>{pkg.sessionsRemaining} / {pkg.totalSessions}</strong></span>
            {completedSessions > 0 && (
              <span style={{ fontSize: "0.78rem", color: "#888" }}>
                {completedSessions} {completedSessions === 1 ? "effettuata" : "effettuate"} · aggiornato automaticamente
              </span>
            )}
          </div>
          <label className="ep-label">
            Prezzo pagato (€)
            <input
              className="ep-input"
              type="number"
              min={0}
              step="0.01"
              value={form.pricePaid}
              onChange={e => setForm(f => ({ ...f, pricePaid: e.target.value }))}
            />
          </label>
          {form.pricePaid !== "" && Number(form.pricePaid) > 0 && Number(form.totalSessions) > 0 && (
            <div className="ep-price-calc">
              €{(Number(form.pricePaid) / Number(form.totalSessions)).toFixed(2).replace(".", ",")} / seduta
            </div>
          )}
          <label className="ep-label">
            Note
            <textarea
              className="ep-textarea"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              maxLength={200}
            />
          </label>
          {error && <div className="ep-error">{error}</div>}
          <div className="ep-actions">
            <button type="button" className="ep-btn ep-btn--ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="ep-btn" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
