import { useCallback, useEffect, useState } from "react";
import DateTimeField from "../../../components/common/DateTimeField";
import { getStaffWorkingHours, updateStaffWorkingHours } from "../../../api/modules/team.api";

/*
 * Per-staff working-hours editor. Reuses the Impostazioni hours pattern
 * (`imp-*` classes, morning/afternoon bands + closed toggle) but drives the
 * staff bulk endpoint (PUT /admin/staff/{id}/working-hours takes the whole week
 * array), so all 7 days share a single "Salva orari" button.
 *
 * A freshly created staff has no seeded rows → we present a default week of
 * closed days for the owner to open.
 */

const DOW_IT = {
  MONDAY: "Lunedì",
  TUESDAY: "Martedì",
  WEDNESDAY: "Mercoledì",
  THURSDAY: "Giovedì",
  FRIDAY: "Venerdì",
  SATURDAY: "Sabato",
  SUNDAY: "Domenica",
};

const DOW_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const toForm = wh => ({
  dayOfWeek: wh.dayOfWeek,
  closed: wh.closed,
  morningStart: wh.morningStart || "",
  morningEnd: wh.morningEnd || "",
  afternoonStart: wh.afternoonStart || "",
  afternoonEnd: wh.afternoonEnd || "",
  hasPm: !!(wh.afternoonStart && wh.afternoonEnd),
});

const defaultWeek = () => DOW_ORDER.map(d => toForm({ dayOfWeek: d, closed: true }));

function validateDay(form) {
  if (form.closed) return "";
  const hasAm = form.morningStart && form.morningEnd;
  const hasPm = form.hasPm && form.afternoonStart && form.afternoonEnd;
  if (!form.morningStart && !form.morningEnd && !form.afternoonStart && !form.afternoonEnd) {
    return `${DOW_IT[form.dayOfWeek]}: almeno una fascia oraria è obbligatoria.`;
  }
  if ((form.morningStart && !form.morningEnd) || (!form.morningStart && form.morningEnd)) {
    return `${DOW_IT[form.dayOfWeek]}: completare entrambi gli orari della mattina.`;
  }
  if (form.hasPm && ((form.afternoonStart && !form.afternoonEnd) || (!form.afternoonStart && form.afternoonEnd))) {
    return `${DOW_IT[form.dayOfWeek]}: completare entrambi gli orari del pomeriggio.`;
  }
  if (hasAm && form.morningStart >= form.morningEnd) {
    return `${DOW_IT[form.dayOfWeek]}: la fine mattina deve essere dopo l'inizio.`;
  }
  if (hasPm && form.afternoonStart >= form.afternoonEnd) {
    return `${DOW_IT[form.dayOfWeek]}: la fine pomeriggio deve essere dopo l'inizio.`;
  }
  if (hasAm && hasPm && form.morningEnd >= form.afternoonStart) {
    return `${DOW_IT[form.dayOfWeek]}: il pomeriggio deve iniziare dopo la mattina.`;
  }
  return "";
}

const toPayload = f => ({
  dayOfWeek: f.dayOfWeek,
  closed: f.closed,
  morningStart: f.closed ? null : f.morningStart || null,
  morningEnd: f.closed ? null : f.morningEnd || null,
  afternoonStart: f.closed || !f.hasPm ? null : f.afternoonStart || null,
  afternoonEnd: f.closed || !f.hasPm ? null : f.afternoonEnd || null,
});

export default function StaffHoursEditor({ staffId }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await getStaffWorkingHours(staffId);
        if (cancelled) return;
        if (!rows.length) {
          setDays(defaultWeek());
        } else {
          const byDay = new Map(rows.map(r => [r.dayOfWeek, r]));
          setDays(DOW_ORDER.map(d => (byDay.has(d) ? toForm(byDay.get(d)) : toForm({ dayOfWeek: d, closed: true }))));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Errore durante il caricamento degli orari.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [staffId]);

  const setDayField = useCallback((idx, key, val) => {
    setSuccess(false);
    setDays(prev => prev.map((d, i) => (i === idx ? { ...d, [key]: val } : d)));
  }, []);

  const handleSave = async () => {
    for (const d of days) {
      const err = validateDay(d);
      if (err) { setError(err); return; }
    }
    setError("");
    setSaving(true);
    try {
      const fresh = await updateStaffWorkingHours(staffId, days.map(toPayload));
      const byDay = new Map(fresh.map(r => [r.dayOfWeek, r]));
      setDays(DOW_ORDER.map(d => (byDay.has(d) ? toForm(byDay.get(d)) : toForm({ dayOfWeek: d, closed: true }))));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e.message || "Errore durante il salvataggio degli orari.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="imp-loading">Caricamento orari…</div>;

  return (
    <div className="team-hours">
      <div className="imp-day-grid">
        {days.map((form, idx) => (
          <div key={form.dayOfWeek} className={`imp-day-card${form.closed ? " imp-day-card--closed" : ""}`}>
            <div className="imp-day-header">
              <span className="imp-day-name">{DOW_IT[form.dayOfWeek]}</span>
              <label className="imp-toggle">
                <input
                  type="checkbox"
                  checked={!form.closed}
                  onChange={e => setDayField(idx, "closed", !e.target.checked)}
                />
                <span className="imp-toggle__track" />
                <span className="imp-toggle__label">{form.closed ? "Chiuso" : "Aperto"}</span>
              </label>
            </div>

            {!form.closed && (
              <div className="imp-day-body">
                <div className="imp-slot-label">Mattina</div>
                <div className="imp-time-row">
                  <div className="imp-time-group">
                    <DateTimeField
                      className="imp-dtf-time"
                      label="Dalle"
                      mode="time"
                      value={form.morningStart}
                      onChange={v => setDayField(idx, "morningStart", v)}
                      placeholder="—:—"
                    />
                  </div>
                  <span className="imp-time-sep">→</span>
                  <div className="imp-time-group">
                    <DateTimeField
                      className="imp-dtf-time"
                      label="Alle"
                      mode="time"
                      value={form.morningEnd}
                      onChange={v => setDayField(idx, "morningEnd", v)}
                      placeholder="—:—"
                    />
                  </div>
                </div>

                <div className="imp-pm-toggle-row">
                  <label className="imp-checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.hasPm}
                      onChange={e =>
                        setDays(prev =>
                          prev.map((d, i) =>
                            i === idx
                              ? {
                                  ...d,
                                  hasPm: e.target.checked,
                                  afternoonStart: e.target.checked ? d.afternoonStart : "",
                                  afternoonEnd: e.target.checked ? d.afternoonEnd : "",
                                }
                              : d,
                          ),
                        )
                      }
                    />
                    Aggiungi fascia pomeriggio
                  </label>
                </div>

                {form.hasPm && (
                  <>
                    <div className="imp-slot-label">Pomeriggio</div>
                    <div className="imp-time-row">
                      <div className="imp-time-group">
                        <DateTimeField
                          className="imp-dtf-time"
                          label="Dalle"
                          mode="time"
                          value={form.afternoonStart}
                          onChange={v => setDayField(idx, "afternoonStart", v)}
                          placeholder="—:—"
                        />
                      </div>
                      <span className="imp-time-sep">→</span>
                      <div className="imp-time-group">
                        <DateTimeField
                          className="imp-dtf-time"
                          label="Alle"
                          mode="time"
                          value={form.afternoonEnd}
                          onChange={v => setDayField(idx, "afternoonEnd", v)}
                          placeholder="—:—"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <div className="imp-field-error">{error}</div>}

      <div className="imp-save-row team-hours-save">
        <button type="button" className="imp-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva orari"}
        </button>
        {success && <span className="imp-save-ok">✓ Salvato</span>}
      </div>
    </div>
  );
}
