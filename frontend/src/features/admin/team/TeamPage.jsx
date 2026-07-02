import { useCallback, useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import SEO from "../../../components/common/SEO";
import { getAllStaff, setStaffActive } from "../../../api/modules/team.api";
import StaffFormModal from "./StaffFormModal";
import StaffManageModal from "./StaffManageModal";

/*
 * Team (owner-only) — manage staff members via the prompt 03 API.
 * With one active staff and no STAFF logins nothing else in the app changes (I1);
 * this page is simply an additional owner-only screen.
 */

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function TeamPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [manage, setManage] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  // 409 blocking list keyed by staff id → [{bookingId,startTime,customerName}]
  const [blocking, setBlocking] = useState({});

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await getAllStaff();
      setStaff([...data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    } catch (e) {
      setError(e.message || "Errore durante il caricamento del team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreated = created => {
    setShowCreate(false);
    setStaff(prev => [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
  };

  const handleUpdated = updated => {
    setStaff(prev =>
      prev.map(s => (s.id === updated.id ? updated : s)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    );
    setManage(m => (m && m.id === updated.id ? updated : m));
  };

  const handleToggleActive = async member => {
    setTogglingId(member.id);
    setBlocking(b => ({ ...b, [member.id]: null }));
    try {
      const updated = await setStaffActive(member.id, !member.active);
      setStaff(prev => prev.map(s => (s.id === updated.id ? updated : s)));
    } catch (e) {
      if (e.status === 409 && Array.isArray(e.details?.blockingBookings)) {
        setBlocking(b => ({ ...b, [member.id]: e.details.blockingBookings }));
      } else {
        setError(e.message || "Errore durante la modifica dello stato.");
      }
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="team-page">
      <SEO title="Team" noindex={true} />
      <Container className="team-container">
        <div className="team-header">
          <div>
            <h1 className="team-title">Team</h1>
            <p className="team-subtitle">Gestisci i membri del team, servizi, orari e assenze</p>
          </div>
          <button type="button" className="imp-btn imp-btn--primary" onClick={() => setShowCreate(true)}>
            + Nuovo membro
          </button>
        </div>

        {error && <div className="imp-global-error">{error}</div>}

        {loading ? (
          <div className="imp-loading">Caricamento team…</div>
        ) : staff.length === 0 ? (
          <div className="imp-empty">Nessun membro del team.</div>
        ) : (
          <div className="team-list">
            {staff.map(m => (
              <div key={m.id} className={`team-card${m.active ? "" : " team-card--inactive"}`}>
                <div className="team-card-main">
                  <span className="team-dot" style={{ background: m.color || "#c9a24b" }} />
                  <div className="team-card-info">
                    <div className="team-card-name">
                      {m.displayName}
                      {!m.active && <span className="team-inactive-tag">inattivo</span>}
                    </div>
                    <div className="team-card-meta">
                      {m.userEmail && <span className="team-card-email">{m.userEmail}</span>}
                      <span className="team-card-count">
                        {(m.serviceIds?.length ?? 0)} servizi
                      </span>
                    </div>
                  </div>
                </div>

                <div className="team-card-actions">
                  <button type="button" className="imp-btn imp-btn--sm imp-btn--ghost" onClick={() => setManage(m)}>
                    Gestisci
                  </button>
                  <button
                    type="button"
                    className={`imp-btn imp-btn--sm ${m.active ? "imp-btn--danger-ghost" : "imp-btn--primary"}`}
                    onClick={() => handleToggleActive(m)}
                    disabled={togglingId === m.id}
                  >
                    {togglingId === m.id ? "…" : m.active ? "Disattiva" : "Riattiva"}
                  </button>
                </div>

                {blocking[m.id] && (
                  <div className="team-blocking">
                    <div className="team-blocking-title">
                      Riassegna prima questi appuntamenti futuri:
                    </div>
                    <ul className="team-blocking-list">
                      {blocking[m.id].map(b => (
                        <li key={b.bookingId}>
                          {fmtDateTime(b.startTime)} — {b.customerName || "Cliente"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Container>

      <StaffFormModal show={showCreate} onHide={() => setShowCreate(false)} onCreated={handleCreated} />
      {manage && <StaffManageModal staff={manage} onHide={() => setManage(null)} onUpdated={handleUpdated} />}
    </div>
  );
}
