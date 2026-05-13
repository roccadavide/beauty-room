import { useEffect, useRef, useState } from "react";
import { updatePackageAssignment } from "../../api/modules/adminAgenda.api";

/**
 * Shared modal for editing a ClientPackageAssignment.
 * Uses .ep-* CSS classes defined in _clienti.css (globally imported).
 *
 * Props:
 *   pkg      — ClientPackageAssignmentDTO object
 *   onClose  — called to dismiss without saving
 *   onSave   — called with the updated DTO after successful save
 */
export default function EditPackageModal({ pkg, onClose, onSave }) {
  const completedSessions = pkg.totalSessions - pkg.sessionsRemaining;

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
    if (Number(form.totalSessions) < completedSessions) {
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
            <button type="submit" className="ep-btn" disabled={saving || savedOk}>
              {savedOk ? "✓ Salvato" : saving ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
