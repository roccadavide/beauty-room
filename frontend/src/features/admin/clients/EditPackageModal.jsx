import { useEffect, useRef, useState } from "react";
import { updatePackageAssignment } from "../../../api/modules/adminAgenda.api";

export default function EditPackageModal({ pkg, onClose, onSave }) {
  const [form, setForm] = useState({
    totalSessions: pkg.totalSessions,
    sessionsRemaining: pkg.sessionsRemaining,
    pricePaid: pkg.pricePaid ?? "",
    notes: pkg.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        clientName: pkg.clientName,
        serviceOptionId: pkg.serviceOptionId ?? null,
        customPackageName: pkg.customPackageName ?? null,
        totalSessions: Number(form.totalSessions),
        sessionsRemaining: Number(form.sessionsRemaining),
        pricePaid: form.pricePaid !== "" ? form.pricePaid : null,
        notes: form.notes || null,
        linkedUserId: pkg.linkedUserId ?? null,
      };
      const updated = await updatePackageAssignment(pkg.id, payload);
      setSavedOk(true);
      timerRef.current = setTimeout(() => { setSavedOk(false); onSave(updated); }, 2000);
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
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
              min={1}
              value={form.totalSessions}
              onChange={e => setForm(f => ({ ...f, totalSessions: e.target.value }))}
              required
            />
          </label>
          <label className="ep-label">
            Sedute rimanenti
            <input
              className="ep-input"
              type="number"
              min={0}
              value={form.sessionsRemaining}
              onChange={e => setForm(f => ({ ...f, sessionsRemaining: e.target.value }))}
              required
            />
          </label>
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
          <label className="ep-label">
            Note
            <textarea
              className="ep-textarea"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </label>
          {error && <div className="ep-error">{error}</div>}
          <div className="ep-actions">
            <button type="button" className="ep-btn ep-btn--ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="ep-btn" disabled={saving || savedOk}>
              {savedOk ? "✓ Salvato" : saving ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
