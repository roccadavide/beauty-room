import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import http from "../../api/httpClient";
import "./AdminToggle.css";

/**
 * AdminToggle — switch attivo/disattivo per entità admin.
 *
 * Props:
 *   entityId        UUID dell'entità (string | number)
 *   isActive        stato attuale (bool)
 *   endpoint        path base API, es. "/service-items"
 *   onToggleSuccess callback(newActiveValue: bool) chiamata dopo successo API
 */
export default function AdminToggle({ entityId, isActive, endpoint, onToggleSuccess }) {
  const [localActive, setLocalActive] = useState(isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync when parent prop changes (es. dopo refetch esterno)
  useEffect(() => {
    setLocalActive(isActive ?? true);
  }, [isActive]);

  const handleToggle = async e => {
    e.stopPropagation();
    e.preventDefault();
    if (loading) return;

    const prev = localActive;
    const next = !prev;

    setLocalActive(next); // aggiornamento ottimistico
    setLoading(true);
    setErrorMsg(null);

    try {
      await http.patch(`${endpoint}/${entityId}/toggle-active`);
      onToggleSuccess?.(next);
    } catch (err) {
      setLocalActive(prev); // rollback
      const msg = err.normalized?.message || err.message || "Errore imprevisto";
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-toggle" onClick={e => e.stopPropagation()}>
      <div className="admin-toggle__row">
        {loading ? (
          <Spinner size="sm" animation="border" className="admin-toggle__spinner" />
        ) : (
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input admin-toggle__switch"
              type="checkbox"
              role="switch"
              checked={localActive}
              onChange={handleToggle}
              id={`toggle-${entityId}`}
              title={localActive ? "Disattiva" : "Attiva"}
            />
          </div>
        )}
        <span className={`admin-toggle__badge ${localActive ? "admin-toggle__badge--active" : "admin-toggle__badge--inactive"}`}>
          {localActive ? "Attivo" : "Disattivato"}
        </span>
      </div>
      {errorMsg && <div className="admin-toggle__error">{errorMsg}</div>}
    </div>
  );
}
