import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import { getActivePackages } from "../../../api/modules/customer.api";
import { cancelPackageAssignment } from "../../../api/modules/adminAgenda.api";
import { formatEuro } from "../../../utils/formatEuro";
import EditPackageModal from "./EditPackageModal";
import StatusPill from "./StatusPill";
import { earliestBookingDate, formatDateTimeIT, openWhatsApp } from "./clientsHelpers";

export default function ClientDetailPanel({ customer, loading, error, onNotesChange, onSettle }) {
  const [notes, setNotes] = useState(customer?.notes || "");
  const [originalNotes, setOriginalNotes] = useState(customer?.notes || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedOk, setSavedOk] = useState(false);
  const saveTimerRef = useRef(null);

  const [inStorePkgs, setInStorePkgs] = useState([]);
  const [inStorePkgsLoading, setInStorePkgsLoading] = useState(false);
  const [pkgError, setPkgError] = useState("");
  const [editPkg, setEditPkg] = useState(null);
  const [deletePkgId, setDeletePkgId] = useState(null);

  // ── Arretrati per-row settle ──
  const [settlingKey, setSettlingKey] = useState(null); // row in flight → blocks double-click
  const [flashKey, setFlashKey]       = useState(null); // optimistic "Saldato ✓" before refetch
  const [errorKey, setErrorKey]       = useState(null); // last row whose settle failed
  const [confirmArretrato, setConfirmArretrato] = useState(null); // row awaiting confirm

  // The panel is reused (not remounted) across customers → clear per-row state on switch.
  useEffect(() => {
    setSettlingKey(null);
    setFlashKey(null);
    setErrorKey(null);
    setConfirmArretrato(null);
  }, [customer?.customerId]);

  const arretratoKey = a => `${a.bookingId}-${a.kind}-${a.refId ?? "x"}`;

  const handleSettleRow = async a => {
    if (settlingKey) return; // a settle is already in flight — ignore (double-click guard)
    const key = arretratoKey(a);
    setErrorKey(null);
    setSettlingKey(key);
    setFlashKey(key); // optimistic ✓ until the parent refetch drops the settled row
    try {
      await onSettle(a); // settleBookingLines + reload (parent)
      setFlashKey(null); // row already gone after reload
    } catch {
      setFlashKey(null); // network/settle error → revert the optimistic flash…
      setErrorKey(key);  // …keep the row "da saldare" and surface the error
    } finally {
      setSettlingKey(null);
    }
  };

  useEffect(() => {
    setNotes(customer?.notes || "");
    setOriginalNotes(customer?.notes || "");
    setSaveError("");
    setSavedOk(false);
  }, [customer]);

  useEffect(() => {
    if (!customer?.customerId) { setInStorePkgs([]); return; }
    setInStorePkgsLoading(true);
    setPkgError("");
    getActivePackages(customer.customerId)
      .then(data => setInStorePkgs(data))
      .catch(e => setPkgError(e.message || "Errore caricamento pacchetti in sede."))
      .finally(() => setInStorePkgsLoading(false));
  }, [customer?.customerId]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const handleDeletePkg = useCallback(async () => {
    if (!deletePkgId) return;
    try {
      await cancelPackageAssignment(deletePkgId);
      setInStorePkgs(prev => prev.filter(p => p.id !== deletePkgId));
    } catch (e) {
      setPkgError(e.message || "Errore durante la cancellazione.");
    } finally {
      setDeletePkgId(null);
    }
  }, [deletePkgId]);

  const handlePkgSaved = useCallback(updated => {
    setInStorePkgs(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditPkg(null);
  }, []);

  if (loading) {
    return (
      <div className="cli-card">
        <div className="cli-loading">
          <Spinner animation="border" size="sm" /> Caricamento scheda cliente…
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="cli-card">
        <div className="cli-search-empty">Cerca una cliente per nome, telefono o email.</div>
      </div>
    );
  }

  const firstBookingDate = earliestBookingDate(customer.bookings);
  const firstYear = firstBookingDate?.getFullYear();
  const firstWhen = firstBookingDate ? firstBookingDate.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : null;

  const notesChanged = notes !== (originalNotes || "");

  const handleSaveNotes = async () => {
    setSaveError("");
    setSaving(true);
    try {
      await onNotesChange(customer.customerId, notes);
      setOriginalNotes(notes);
      setSavedOk(true);
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSavedOk(false), 2000);
    } catch (e) {
      setSaveError(e.message || "Errore durante il salvataggio delle note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Header + KPI */}
      <div className="cli-card">
        {error && <div className="cli-error">{error}</div>}

        <div className="cli-customer-header">
          <div className="cli-customer-name">{customer.fullName || "—"}</div>
          <div className="cli-customer-sub">
              <span className="cli-phone-row">
        <span>{customer.phone || "Telefono non indicato"}</span>
        {customer.phone && (
          <button
            className="cli-wa-btn"
            onClick={() => openWhatsApp(customer.phone)}
            title="Apri su WhatsApp"
            type="button"
          >
            <span>💬</span>
            <span>Contatta su WhatsApp</span>
          </button>
        )}
              </span>
            {customer.email && <span>{customer.email}</span>}
          </div>
          <div className="cli-customer-meta">
            {firstWhen && <span>Prima prenotazione: {firstWhen}</span>}
            {firstYear && <span className="cli-badge-year">Cliente dal {firstYear}</span>}
          </div>
        </div>

        <div className="cli-kpi-row">
          <div className="cli-kpi">
            <div className="cli-kpi-label">Totale appuntamenti</div>
            <div className="cli-kpi-value">{customer.totalBookings}</div>
          </div>
          <div className="cli-kpi cli-kpi--ok">
            <div className="cli-kpi-label">Completati ✓</div>
            <div className="cli-kpi-value">{customer.completedBookings}</div>
          </div>
          <div className="cli-kpi cli-kpi--bad">
            <div className="cli-kpi-label">Cancellati / No-show ❌</div>
            <div className="cli-kpi-value">{customer.cancelledBookings}</div>
          </div>
        </div>

        {pkgError && <div className="cli-error">{pkgError}</div>}

        {/* Pacchetti del cliente — online (Stripe, FK-bridged) e in sede (admin), distinti per
            origine. Entrambi arrivano dallo stesso endpoint /active-packages; il campo `source`
            li separa. Gli online sono read-only: dietro non c'è un ClientPackageAssignment, quindi
            le azioni modifica/cancella (che colpiscono endpoint assignment) non si applicano. */}
        {inStorePkgsLoading && (
          <div className="cli-packages-block">
            <div className="cli-loading" style={{ padding: "8px 0" }}>
              <Spinner animation="border" size="sm" />
            </div>
          </div>
        )}

        {!inStorePkgsLoading && inStorePkgs.some(p => p.source === "ONLINE") && (
          <div className="cli-packages-block">
            <div className="cli-section-title">Pacchetti online</div>
            <div className="cli-packages">
              {inStorePkgs.filter(p => p.source === "ONLINE").map(p => {
                const total = p.totalSessions || 0;
                const remaining = p.sessionsRemaining || 0;
                const ratio = total > 0 ? remaining / total : 0;
                const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
                let barCls = "cli-pkg-bar-fill--good";
                if (remaining <= 1) barCls = "cli-pkg-bar-fill--critical";
                else if (pct <= 50) barCls = "cli-pkg-bar-fill--warn";
                const expiry = p.expiryDate ? new Date(p.expiryDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : null;
                return (
                  <div key={p.id} className="cli-pkg-card">
                    <div className="cli-pkg-name">{p.displayName || p.serviceTitle || "Pacchetto"}</div>
                    <div className="cli-pkg-bar">
                      <div className={`cli-pkg-bar-fill ${barCls}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="cli-pkg-meta">
                      <span>{remaining} / {total} sedute rimanenti</span>
                      {expiry && <span>Scade il {expiry}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!inStorePkgsLoading && inStorePkgs.some(p => p.source === "ADMIN") && (
          <div className="cli-packages-block">
            <div className="cli-section-title">Pacchetti in sede</div>
            <div className="cli-packages">
              {inStorePkgs.filter(p => p.source === "ADMIN").map(p => {
                const total = p.totalSessions || 0;
                const remaining = p.sessionsRemaining || 0;
                const ratio = total > 0 ? remaining / total : 0;
                const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
                let barCls = "cli-pkg-bar-fill--good";
                if (remaining <= 1) barCls = "cli-pkg-bar-fill--critical";
                else if (pct <= 50) barCls = "cli-pkg-bar-fill--warn";
                return (
                  <div key={p.id} className="cli-pkg-card cli-pkg-card--instore">
                    <div className="cli-pkg-card-header">
                      <div className="cli-pkg-name">{p.displayName || p.serviceOptionName || "Pacchetto"}</div>
                      <div className="cli-pkg-actions">
                        <button
                          className="cli-icon-btn"
                          title="Modifica"
                          onClick={() => setEditPkg(p)}
                          type="button"
                        >
                          ✏
                        </button>
                        <button
                          className="cli-icon-btn cli-icon-btn--danger"
                          title="Cancella pacchetto"
                          onClick={() => setDeletePkgId(p.id)}
                          type="button"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    <div className="cli-pkg-bar">
                      <div className={`cli-pkg-bar-fill ${barCls}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="cli-pkg-meta">
                      <span>{remaining} / {total} sedute rimanenti</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {editPkg && (
          <EditPackageModal pkg={editPkg} onClose={() => setEditPkg(null)} onSave={handlePkgSaved} />
        )}

        <ConfirmDialog
          show={!!deletePkgId}
          onHide={() => setDeletePkgId(null)}
          onConfirm={handleDeletePkg}
          title="Cancella pacchetto"
          message="Sei sicura di voler cancellare questo pacchetto in sede? Le sedute già usate rimarranno nello storico prenotazioni."
          confirmLabel="Cancella"
          confirmVariant="danger"
        />
      </div>

      {/* Note + storico */}
      <div className="cli-card">
        <div className="cli-notes-header">
          <div className="cli-notes-label">Note cliente</div>
          <div className="cli-notes-meta">{notes.length}/2000 caratteri</div>
        </div>

        <textarea className="cli-notes-textarea" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />

        <div className="cli-notes-actions">
          <button className="cli-btn" disabled={!notesChanged || saving} onClick={handleSaveNotes}>
            {saving ? "Salvataggio…" : "Salva note"}
          </button>
          {savedOk && <span className="cli-save-ok">✓ Salvato</span>}
        </div>
        {saveError && <div className="cli-notes-error">{saveError}</div>}
      </div>

      {/* Arretrati / Da saldare — righe non saldate su appuntamenti COMPLETED passati.
          Dato 100% da backend (customer.arretrati): nessun ricalcolo/totale lato FE.
          Render solo se presenti (niente riquadro vuoto). */}
      {customer.arretrati?.length > 0 && (
        <div className="cli-card">
          <div className="cli-section-title">Arretrati / Da saldare</div>
          <div className="cli-history-wrapper">
            <div className="cli-history-list">
              {customer.arretrati.map((a, idx) => {
                const key = arretratoKey(a);
                const flashed = flashKey === key;
                const errored = errorKey === key;
                const busy = settlingKey === key;
                return (
                  <div key={`${key}-${idx}`}>
                    <div className="cli-history-item">
                      <div className="cli-history-main">
                        <div className="cli-history-title">{a.label}</div>
                        <div className="cli-history-meta">{formatDateTimeIT(a.occurredAt)}</div>
                      </div>
                      {/* price + action inline — reuses cli-* classes; the small flex
                          gap is an inline style matching the admin components' idiom. */}
                      <div className="cli-history-status" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {flashed ? (
                          <span className="cli-save-ok">Saldato ✓</span>
                        ) : (
                          <>
                            <span>{formatEuro(a.price)}</span>
                            <button
                              type="button"
                              className="cli-btn cli-btn--sm"
                              disabled={settlingKey !== null}
                              onClick={() => setConfirmArretrato(a)}
                            >
                              {busy ? "…" : errored ? "Riprova" : "Salda"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {errored && (
                      <div className="cli-notes-error">Errore nel salvataggio. La riga resta da saldare.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Confirm before settling — guards against saldare the wrong arretrato.
          Reuses ConfirmDialog (portal, cd-* classes) — no new CSS. */}
      <ConfirmDialog
        show={!!confirmArretrato}
        onHide={() => setConfirmArretrato(null)}
        onConfirm={() => {
          const a = confirmArretrato;
          setConfirmArretrato(null);
          if (a) handleSettleRow(a);
        }}
        title="Salda arretrato"
        message={
          confirmArretrato
            ? `Confermi di saldare questo arretrato? ${confirmArretrato.label} del ${formatDateTimeIT(confirmArretrato.occurredAt)} — ${formatEuro(confirmArretrato.price)}`
            : ""
        }
        confirmLabel="Salda"
        confirmVariant="primary"
      />

      <div className="cli-card">
        <div className="cli-section-title">Storico prenotazioni</div>
        <div className="cli-history-wrapper">
          {customer.bookings?.length ? (
            <div className="cli-history-list">
              {customer.bookings.map(b => (
                <div key={b.bookingId} className="cli-history-item">
                  <div className="cli-history-main">
                    <div className="cli-history-title">
                      {b.serviceTitle || "Servizio"}
                      {b.optionName && ` · ${b.optionName}`}
                    </div>
                    <div className="cli-history-meta">{formatDateTimeIT(b.startTime)}</div>
                  </div>
                  <div className="cli-history-status">
                    <StatusPill status={b.bookingStatus} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="cli-empty-history">Nessun appuntamento trovato.</div>
          )}
        </div>
      </div>
    </>
  );
}
