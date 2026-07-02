import { useCallback, useEffect, useState } from "react";
import DateTimeField from "../../../components/common/DateTimeField";
import { createStaffAbsence, deleteStaffAbsence, getStaffAbsences } from "../../../api/modules/team.api";

/*
 * Per-staff absences = Closure rows carrying this member's staffId (decision #7).
 * Reuses the closures form shape (date range + optional time window + reason).
 * Inline form (no nested modal) since this lives inside the manage modal.
 */

const EMPTY = { startDate: "", endDate: "", fullDay: true, startTime: "", endTime: "", reason: "" };

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function StaffAbsences({ staffId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const data = await getStaffAbsences(staffId);
      setList(
        [...data].sort((a, b) => (a.startDate || a.date || "").localeCompare(b.startDate || b.date || "")),
      );
    } catch (e) {
      setError(e.message || "Errore durante il caricamento delle assenze.");
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const canSave =
    form.startDate && form.reason.trim() && (form.fullDay || (form.startTime && form.endTime));

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    const payload = {
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      startTime: form.fullDay ? null : form.startTime || null,
      endTime: form.fullDay ? null : form.endTime || null,
      reason: form.reason.trim(),
      staffId,
    };
    try {
      await createStaffAbsence(payload);
      setForm(EMPTY);
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(e.message || "Errore durante la creazione dell'assenza.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async id => {
    setDeletingId(id);
    setError("");
    try {
      await deleteStaffAbsence(id);
      await refresh();
    } catch (e) {
      setError(e.message || "Errore durante l'eliminazione.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="imp-loading">Caricamento assenze…</div>;

  return (
    <div className="team-absences">
      <div className="imp-section-header">
        <div>
          <div className="imp-section-title">Assenze</div>
          <div className="imp-section-sub">Ferie o blocchi orari di questo membro</div>
        </div>
        {!showForm && (
          <button type="button" className="imp-btn imp-btn--primary" onClick={() => setShowForm(true)}>
            + Aggiungi assenza
          </button>
        )}
      </div>

      {showForm && (
        <div className="imp-closure-form">
          <div className="imp-form-title">➕ Nuova assenza</div>

          <div className="imp-form-row imp-form-row--times">
            <div className="imp-form-group">
              <label className="imp-form-label">Dal</label>
              <DateTimeField
                mode="date"
                value={form.startDate}
                onChange={v => setField("startDate", v)}
                placeholder="Data inizio"
              />
            </div>
            <div className="imp-form-group">
              <label className="imp-form-label">Al (opzionale)</label>
              <DateTimeField
                mode="date"
                value={form.endDate}
                onChange={v => setField("endDate", v)}
                placeholder="Data fine"
              />
            </div>
          </div>

          <label className="imp-checkbox-label">
            <input
              type="checkbox"
              checked={form.fullDay}
              onChange={e => setField("fullDay", e.target.checked)}
            />
            Intera giornata
          </label>

          {!form.fullDay && (
            <div className="imp-form-row imp-form-row--times">
              <div className="imp-form-group">
                <label className="imp-form-label">Dalle</label>
                <DateTimeField
                  mode="time"
                  value={form.startTime}
                  onChange={v => setField("startTime", v)}
                  placeholder="—:—"
                />
              </div>
              <div className="imp-form-group">
                <label className="imp-form-label">Alle</label>
                <DateTimeField
                  mode="time"
                  value={form.endTime}
                  onChange={v => setField("endTime", v)}
                  placeholder="—:—"
                />
              </div>
            </div>
          )}

          <div className="imp-form-row">
            <div className="imp-form-group imp-form-group--full">
              <label className="imp-form-label">Motivo</label>
              <input
                type="text"
                className="imp-form-input"
                maxLength={150}
                placeholder="es. Ferie"
                value={form.reason}
                onChange={e => setField("reason", e.target.value)}
              />
            </div>
          </div>

          <div className="imp-form-actions">
            <button
              type="button"
              className="imp-btn imp-btn--ghost"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY);
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              className="imp-btn imp-btn--primary"
              onClick={handleCreate}
              disabled={!canSave || saving}
            >
              {saving ? "Salvataggio…" : "Salva assenza"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="imp-field-error">{error}</div>}

      {list.length === 0 && !showForm ? (
        <div className="imp-empty">Nessuna assenza registrata.</div>
      ) : (
        <div className="imp-closure-list">
          {list.map(c => {
            const start = c.startDate || c.date;
            const end = c.endDate || c.startDate || c.date;
            const range = end && end !== start ? `${fmtDate(start)} → ${fmtDate(end)}` : fmtDate(start);
            return (
              <div key={c.id} className="imp-closure-card">
                <div className="imp-closure-info">
                  <div className="imp-closure-date">{range}</div>
                  <div className="imp-closure-meta">
                    <span className={`imp-badge ${c.fullDay ? "imp-badge--full" : "imp-badge--partial"}`}>
                      {c.fullDay ? "Intera giornata" : `${c.startTime || ""}–${c.endTime || ""}`}
                    </span>
                    {c.reason && <span className="imp-closure-reason">{c.reason}</span>}
                  </div>
                </div>
                <div className="imp-closure-actions">
                  <button
                    type="button"
                    className="imp-btn imp-btn--sm imp-btn--danger-ghost"
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                  >
                    {deletingId === c.id ? "…" : "Elimina"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
