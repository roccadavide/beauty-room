import { useEffect, useMemo, useState } from "react";
import { fetchServices } from "../../../api/modules/services.api";
import { getStaffServices, replaceStaffServices } from "../../../api/modules/team.api";

/*
 * Service-assignment checklist for one staff member. Reuses the admin catalog
 * fetch (fetchServices, includeInactive) and PUTs the whole selected set
 * (replace-set semantics on staff_services).
 */
export default function StaffServicesEditor({ staffId }) {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
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
        const [all, assigned] = await Promise.all([fetchServices(true), getStaffServices(staffId)]);
        if (cancelled) return;
        setCatalog(Array.isArray(all) ? all : []);
        setSelected(new Set(assigned.map(String)));
      } catch (e) {
        if (!cancelled) setError(e.message || "Errore durante il caricamento dei servizi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [staffId]);

  const sorted = useMemo(
    () => [...catalog].sort((a, b) => (a.title || "").localeCompare(b.title || "", "it")),
    [catalog],
  );

  const toggle = id => {
    setSuccess(false);
    setSelected(prev => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const ids = await replaceStaffServices(staffId, Array.from(selected));
      setSelected(new Set(ids.map(String)));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e.message || "Errore durante il salvataggio dei servizi.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="imp-loading">Caricamento servizi…</div>;

  return (
    <div className="team-services">
      <div className="team-services-hint">
        Seleziona i servizi che questo membro può eseguire ({selected.size} selezionati).
      </div>

      {sorted.length === 0 ? (
        <div className="imp-empty">Nessun servizio nel catalogo.</div>
      ) : (
        <div className="team-services-list">
          {sorted.map(s => (
            <label
              key={s.serviceId}
              className={`team-service-item${selected.has(String(s.serviceId)) ? " team-service-item--on" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.has(String(s.serviceId))}
                onChange={() => toggle(s.serviceId)}
              />
              <span className="team-service-name">{s.title}</span>
              {!(s.active ?? true) && <span className="team-service-inactive">inattivo</span>}
            </label>
          ))}
        </div>
      )}

      {error && <div className="imp-field-error">{error}</div>}

      <div className="imp-save-row">
        <button type="button" className="imp-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva servizi"}
        </button>
        {success && <span className="imp-save-ok">✓ Salvato</span>}
      </div>
    </div>
  );
}
