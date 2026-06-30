import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import { fetchAllUsers, patchUserVerified } from "../../../api/modules/users.api";
import { markLatestNoShowForUser } from "../../../api/modules/bookings.api";
import { normalizeItalianPhone } from "../../../utils/reminders";
import "./AccountsPanel.css";

// Initials (name + surname) for the hero avatar — mirrors the cdp/agenda idiom.
const acctInitials = (name, surname) =>
  `${(name || "").trim()[0] || ""}${(surname || "").trim()[0] || ""}`.toUpperCase() || "?";

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

      <div className="acc-toolbar">
        <div className="acc-filters">
          {["ALL", "VERIFIED", "UNVERIFIED"].map(f => (
            <button
              key={f}
              type="button"
              className={`acc-pill ${usersFilter === f ? "is-active" : ""}`}
              onClick={() => setUsersFilter(f)}
            >
              {f === "ALL" && "Tutti"}
              {f === "VERIFIED" && "✦ Di fiducia"}
              {f === "UNVERIFIED" && "Standard"}
            </button>
          ))}
        </div>
        <div className="acc-toolbar__right">
          <input
            className="acc-search"
            placeholder="Cerca per nome o email…"
            value={usersSearch}
            onChange={e => setUsersSearch(e.target.value)}
          />
          <button
            type="button"
            className="acc-reload"
            onClick={() => { setUsers([]); loadUsers(); }}
            title="Ricarica"
          >
            ↻
          </button>
        </div>
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
          <div className="acc-empty">Nessun utente trovato.</div>
        );

        return (
          <div className="acc-list">
            {filtered.map(u => (
              <div key={u.id} className={`acc-card ${u.isVerified ? "acc-card--verified" : ""}`}>
                <div className="acc-card__main">
                  <div className="acc-avatar" aria-hidden="true">{acctInitials(u.name, u.surname)}</div>
                  <div className="acc-id">
                    <div className="acc-name-row">
                      <span className="acc-name">{u.name} {u.surname}</span>
                      {u.isVerified && <span className="acc-chip acc-chip--trust">✦ Cliente di fiducia</span>}
                    </div>
                    <div className="acc-contacts">
                      {u.email && (
                        <span className="acc-contact">
                          <span className="acc-contact__icon">✉</span>
                          <span className="acc-contact__text">{u.email}</span>
                        </span>
                      )}
                      {u.phone && (
                        <span className="acc-contact">
                          <span className="acc-contact__icon">📱</span>
                          <span className="acc-contact__text">{u.phone}</span>
                        </span>
                      )}
                    </div>
                    {u.phone && (
                      <div className="acc-actions">
                        <a
                          href={`https://wa.me/${normalizeItalianPhone(u.phone)}?text=${encodeURIComponent(`Ciao ${u.name}, ti scrivo da Beauty Room.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cli-wa-btn"
                        >
                          <span>💬</span>
                          <span>WhatsApp</span>
                        </a>
                        <a href={`tel:${u.phone}`} className="acc-btn acc-btn--ghost">
                          📞 Chiama
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="acc-card__side">
                  <button
                    type="button"
                    className={`acc-btn ${u.isVerified ? "acc-btn--danger" : "acc-btn--trust"}`}
                    onClick={() => handleToggleVerified(u.id, u.isVerified)}
                  >
                    {u.isVerified ? "Rimuovi fiducia" : "✦ Verifica"}
                  </button>
                  {noShowConfirm === u.id ? (
                    <div className="acc-confirm">
                      <span className="acc-confirm__q">Segnare no-show?</span>
                      <button
                        type="button"
                        className="acc-btn acc-btn--xs acc-btn--danger"
                        onClick={() => handleMarkNoShow(u.id)}
                        disabled={noShowLoading === u.id}
                      >
                        {noShowLoading === u.id ? "…" : "Sì"}
                      </button>
                      <button
                        type="button"
                        className="acc-btn acc-btn--xs acc-btn--ghost"
                        onClick={() => setNoShowConfirm(null)}
                      >
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="acc-noshow"
                      onClick={() => setNoShowConfirm(u.id)}
                    >
                      Segna no-show
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
