import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import { fetchAllUsers, patchUserVerified } from "../../../api/modules/users.api";
import { markLatestNoShowForUser } from "../../../api/modules/bookings.api";
import { normalizeItalianPhone } from "../../../utils/reminders";

// Self-contained "Account" tab. Owns its own state and loads on mount.
export default function AccountsPanel() {
  const [users, setUsers]             = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError]   = useState("");
  const [usersSearch, setUsersSearch] = useState("");
  const [usersFilter, setUsersFilter] = useState("ALL"); // ALL | VERIFIED | UNVERIFIED
  const [verifyToast, setVerifyToast] = useState(null);
  const [noShowLoading, setNoShowLoading] = useState(null); // userId in progress
  const [noShowConfirm, setNoShowConfirm] = useState(null); // userId awaiting confirm

  // Real fetch — NO length guard, so the ↻ reload button actually re-fetches
  // (the old guard returned early whenever `users.length > 0`, leaving reload to
  // only CLEAR the list). The mount-once `didLoadRef` guard below keeps the
  // load-on-mount behavior to a single fetch.
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const data = await fetchAllUsers({ size: 200, sort: "name" });
      setUsers(data.content || []);
    } catch (e) {
      setUsersError(e.message || "Errore caricamento utenti.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const handleToggleVerified = useCallback(async (userId, currentVerified) => {
    const newVal = !currentVerified;
    try {
      const updated = await patchUserVerified(userId, newVal);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified: updated.isVerified } : u));
      setVerifyToast({ text: newVal ? "Cliente di fiducia attivato" : "Verifica rimossa", ok: true });
    } catch (e) {
      setVerifyToast({ text: e.message || "Errore", ok: false });
    } finally {
      setTimeout(() => setVerifyToast(null), 2500);
    }
  }, []);

  const handleMarkNoShow = useCallback(async userId => {
    setNoShowLoading(userId);
    setNoShowConfirm(null);
    try {
      await markLatestNoShowForUser(userId);
      setVerifyToast({ text: "No-show registrato", ok: true });
    } catch (e) {
      setVerifyToast({ text: e.message || "Nessuna prenotazione trovata", ok: false });
    } finally {
      setNoShowLoading(null);
      setTimeout(() => setVerifyToast(null), 2500);
    }
  }, []);

  // One-time load on mount (replaces the parent's lazy loader). The ref guard
  // keeps it to a single fetch even under StrictMode double-invoke.
  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    loadUsers();
  }, [loadUsers]);

  return (
    <div className="cli-pkg-panel">
      {verifyToast && (
        <div className={`cli-verify-toast ${verifyToast.ok ? "cli-verify-toast--ok" : "cli-verify-toast--err"}`}>
          {verifyToast.text}
        </div>
      )}

      <div className="cli-pkg-filters">
        {["ALL", "VERIFIED", "UNVERIFIED"].map(f => (
          <button
            key={f}
            type="button"
            className={`cli-pkg-ftab ${usersFilter === f ? "is-active" : ""}`}
            onClick={() => setUsersFilter(f)}
          >
            {f === "ALL" && "Tutti"}
            {f === "VERIFIED" && "✅ Clienti di fiducia"}
            {f === "UNVERIFIED" && "Utenti standard"}
          </button>
        ))}
        <input
          className="cli-pkg-search"
          placeholder="Cerca per nome o email…"
          value={usersSearch}
          onChange={e => setUsersSearch(e.target.value)}
        />
        <button
          type="button"
          className="cli-pkg-reload"
          onClick={() => { setUsers([]); loadUsers(); }}
          title="Ricarica"
        >
          ↻
        </button>
      </div>

      {usersLoading && (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" size="sm" />
        </div>
      )}
      {usersError && <div className="cli-error">{usersError}</div>}

      {!usersLoading && !usersError && (() => {
        const q = usersSearch.toLowerCase();
        const filtered = users.filter(u => {
          const matchFilter =
            usersFilter === "ALL" ? true :
            usersFilter === "VERIFIED" ? u.isVerified :
            !u.isVerified;
          const matchSearch = !q || (
            `${u.name} ${u.surname}`.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
          );
          return matchFilter && matchSearch && u.role !== "ADMIN";
        });

        if (!filtered.length) return (
          <div className="cli-empty-history" style={{ padding: "3rem 0", textAlign: "center" }}>
            Nessun utente trovato.
          </div>
        );

        return (
          <div className="cli-pkg-global-list">
            {filtered.map(u => (
              <div key={u.id} className={`cli-pkg-global-card ${u.isVerified ? "cli-user-card--verified" : ""}`}>
                <div className="cli-pkg-global-left">
                  <div className="cli-pkg-global-name">
                    {u.name} {u.surname}
                    {u.isVerified && <span className="cli-verified-badge">Cliente di Fiducia ✅</span>}
                  </div>
                  <div className="cli-pkg-global-email">{u.email}</div>
                  {u.phone && <div className="cli-pkg-global-email">{u.phone}</div>}
                  {u.phone && (
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                      <a
                        href={`https://wa.me/${normalizeItalianPhone(u.phone)}?text=${encodeURIComponent(`Ciao ${u.name}, ti scrivo da Beauty Room.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cli-btn cli-btn--sm cli-btn--ghost"
                      >
                        WhatsApp
                      </a>
                      <a
                        href={`tel:${u.phone}`}
                        className="cli-btn cli-btn--sm cli-btn--ghost"
                      >
                        Chiama
                      </a>
                    </div>
                  )}
                </div>
                <div className="cli-pkg-global-right" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end" }}>
                  <button
                    type="button"
                    className={`cli-btn cli-btn--sm ${u.isVerified ? "cli-btn--danger" : "cli-btn--trust"}`}
                    onClick={() => handleToggleVerified(u.id, u.isVerified)}
                  >
                    {u.isVerified ? "Rimuovi fiducia" : "Verifica"}
                  </button>
                  {noShowConfirm === u.id ? (
                    <>
                      <span style={{ fontSize: "0.75rem", color: "#9c8880" }}>Sei sicura?</span>
                      <button
                        type="button"
                        className="cli-btn cli-btn--sm cli-btn--danger"
                        onClick={() => handleMarkNoShow(u.id)}
                        disabled={noShowLoading === u.id}
                      >
                        {noShowLoading === u.id ? "…" : "Sì, no-show"}
                      </button>
                      <button
                        type="button"
                        className="cli-btn cli-btn--sm cli-btn--ghost"
                        onClick={() => setNoShowConfirm(null)}
                      >
                        Annulla
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="cli-btn cli-btn--sm cli-btn--ghost"
                      onClick={() => setNoShowConfirm(u.id)}
                    >
                      No-Show
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
