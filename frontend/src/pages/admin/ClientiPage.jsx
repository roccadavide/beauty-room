import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Container, Spinner } from "react-bootstrap";
import CustomerAutocomplete from "../../components/admin/CustomerAutocomplete";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { getCustomerSummary, updateCustomerNotes, getActivePackages } from "../../api/modules/customer.api";
import { cancelPackageAssignment, updatePackageAssignment, settleBookingLines } from "../../api/modules/adminAgenda.api";
import { fetchActivePackages, fetchPackageKpis } from "../../api/modules/packages.api";
import { fetchAllUsers, patchUserVerified } from "../../api/modules/users.api";
import { markLatestNoShowForUser } from "../../api/modules/bookings.api";
import SEO from "../../components/common/SEO";
import { buildArretratoSettlePayload } from "../../components/admin/settlePayload";
import { formatEuro } from "../../utils/formatEuro";

const STATUS_META = {
  PENDING: { label: "In attesa", tone: "pending" },
  PENDING_PAYMENT: { label: "Attesa pagamento", tone: "pending" },
  NO_SHOW: { label: "Non presentata", tone: "noshow" },
  CONFIRMED: { label: "Confermato", tone: "confirmed" },
  COMPLETED: { label: "Completato", tone: "completed" },
  CANCELLED: { label: "Cancellato", tone: "cancelled" },
};

function StatusPill({ status }) {
  const s = STATUS_META[status] || { label: status, tone: "neutral" };
  return <span className={`ag-pill ag-pill--${s.tone}`}>{s.label}</span>;
}

function earliestBookingDate(bookings) {
  if (!bookings?.length) return null;
  const last = bookings[bookings.length - 1];
  return last.startTime ? new Date(last.startTime) : null;
}

function formatDateTimeIT(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const openWhatsApp = phone => {
  if (!phone) return;
  const clean = phone.replace(/[\s\-().+]/g, "");
  const number = clean.startsWith("39") ? clean : `39${clean}`;
  window.open(`https://wa.me/${number}`, "_blank", "noopener,noreferrer");
};

function daysUntilExpiry(isoDate) {
  if (!isoDate) return null;
  const diff = new Date(isoDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function expiryTag(isoDate) {
  const days = daysUntilExpiry(isoDate);
  if (days === null) return null;
  if (days < 0)   return { label: "Scaduto",           cls: "pkg-tag pkg-tag--expired"  };
  if (days <= 30) return { label: `Scade in ${days}g`, cls: "pkg-tag pkg-tag--expiring" };
  return           { label: `Scade in ${days}g`,        cls: "pkg-tag pkg-tag--ok"       };
}

function EditPackageModal({ pkg, onClose, onSave }) {
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

function ClientSummary({ customer, loading, error, onNotesChange, onSettle }) {
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

        {customer.packages?.length > 0 && (
          <div className="cli-packages-block">
            <div className="cli-section-title">Pacchetti attivi (online)</div>
            <div className="cli-packages">
              {customer.packages.map(p => {
                const total = p.sessionsTotal || 0;
                const remaining = p.sessionsRemaining || 0;
                const ratio = total > 0 ? remaining / total : 0;
                const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
                let barCls = "cli-pkg-bar-fill--good";
                if (remaining <= 1) barCls = "cli-pkg-bar-fill--critical";
                else if (pct <= 50) barCls = "cli-pkg-bar-fill--warn";

                const expiry = p.expiryDate ? new Date(p.expiryDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : null;

                return (
                  <div key={p.packageCreditId} className="cli-pkg-card">
                    <div className="cli-pkg-name">{p.serviceOptionName || "Pacchetto"}</div>
                    <div className="cli-pkg-bar">
                      <div className={`cli-pkg-bar-fill ${barCls}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="cli-pkg-meta">
                      <span>
                        {remaining} / {total} sedute rimanenti
                      </span>
                      {expiry && <span>Scade il {expiry}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pkgError && <div className="cli-error">{pkgError}</div>}

        {(inStorePkgsLoading || inStorePkgs.length > 0) && (
          <div className="cli-packages-block">
            <div className="cli-section-title">Pacchetti in sede</div>
            {inStorePkgsLoading ? (
              <div className="cli-loading" style={{ padding: "8px 0" }}>
                <Spinner animation="border" size="sm" />
              </div>
            ) : (
              <div className="cli-packages">
                {inStorePkgs.map(p => {
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
            )}
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

export default function ClientiPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab]   = useState("clienti");
  const [packages, setPackages]     = useState([]);
  const [pkgKpis, setPkgKpis]       = useState(null);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [pkgError, setPkgError]     = useState("");
  const [pkgFilter, setPkgFilter]   = useState("ALL");
  const [pkgSearch, setPkgSearch]   = useState("");

  // ── Account tab state ──
  const [users, setUsers]             = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError]   = useState("");
  const [usersSearch, setUsersSearch] = useState("");
  const [usersFilter, setUsersFilter] = useState("ALL"); // ALL | VERIFIED | UNVERIFIED
  const [verifyToast, setVerifyToast] = useState(null);
  const [noShowLoading, setNoShowLoading] = useState(null); // userId in progress
  const [noShowConfirm, setNoShowConfirm] = useState(null); // userId awaiting confirm

  const handleSelect = useCallback(async customer => {
    setSelected(customer);
    setDetail(null);
    setError("");
    setLoading(true);
    try {
      const data = await getCustomerSummary(customer.customerId);
      setDetail(data);
    } catch (e) {
      setError(e.message || "Errore caricamento cliente.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNotesChange = useCallback(async (customerId, notes) => {
    await updateCustomerNotes(customerId, notes);
    setDetail(prev => (prev ? { ...prev, notes } : prev));
  }, []);

  // Refetch the open customer so a settled arretrato drops out of the panel.
  const reloadDetail = useCallback(async () => {
    const id = detail?.customerId;
    if (!id) return;
    const data = await getCustomerSummary(id);
    setDetail(data);
  }, [detail?.customerId]);

  // Settle ONE arretrato line. The booking is already COMPLETED → alsoComplete:false
  // (never re-completes). Reuses the shared kind→payload builder (CompletionDrawer
  // vocabulary). settleBookingLines may throw → the row handler keeps the row and
  // shows the error; a post-settle reload failure is swallowed (settle succeeded).
  const handleSettleArretrato = useCallback(async a => {
    await settleBookingLines(a.bookingId, buildArretratoSettlePayload(a));
    try { await reloadDetail(); } catch { /* settle ok; next open refreshes */ }
  }, [reloadDetail]);

  // Deep-link from the OUTSTANDING_PAYMENT notification: /admin/clienti?customerId=…
  // auto-selects that customer and loads the card. A stale/unknown id is swallowed
  // (no selection, no crash, no console noise).
  const [searchParams] = useSearchParams();
  const deepLinkCustomerId = searchParams.get("customerId");
  useEffect(() => {
    if (!deepLinkCustomerId) return;
    let cancelled = false;
    (async () => {
      setError("");
      setLoading(true);
      try {
        const data = await getCustomerSummary(deepLinkCustomerId);
        if (cancelled) return;
        setSelected({ customerId: deepLinkCustomerId, fullName: data.fullName });
        setDetail(data);
      } catch {
        if (!cancelled) { setSelected(null); setDetail(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [deepLinkCustomerId]);

  const loadPackages = useCallback(async () => {
    if (packages.length > 0) return;
    setPkgLoading(true);
    setPkgError("");
    try {
      const [list, kpis] = await Promise.all([fetchActivePackages(), fetchPackageKpis()]);
      setPackages(list);
      setPkgKpis(kpis);
    } catch (e) {
      setPkgError(e.message || "Errore caricamento pacchetti.");
    } finally {
      setPkgLoading(false);
    }
  }, [packages.length]);

  const loadUsers = useCallback(async () => {
    if (users.length > 0) return;
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
  }, [users.length]);

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

  const handleTabChange = useCallback(tab => {
    setActiveTab(tab);
    if (tab === "pacchetti") loadPackages();
    if (tab === "account") loadUsers();
  }, [loadPackages, loadUsers]);

  const summaryError = error || "";

  return (
    <div className="cli-page">
      <SEO title="Clienti" noindex={true} />
      <Container className="cli-container">
        <header className="cli-header">
          <h1 className="cli-title">Gestione</h1>
          <p className="cli-subtitle">Clienti, pacchetti attivi e storico prenotazioni</p>
        </header>

        {/* ── Tab switcher ── */}
        <div className="cli-tabs">
          <button
            className={`cli-tab ${activeTab === "clienti" ? "is-active" : ""}`}
            onClick={() => handleTabChange("clienti")}
            type="button"
          >
            👤 Clienti
          </button>
          <button
            className={`cli-tab ${activeTab === "pacchetti" ? "is-active" : ""}`}
            onClick={() => handleTabChange("pacchetti")}
            type="button"
          >
            📦 Pacchetti attivi
            {pkgKpis?.active > 0 && (
              <span className="cli-tab-badge">{pkgKpis.active}</span>
            )}
          </button>
          <button
            className={`cli-tab ${activeTab === "account" ? "is-active" : ""}`}
            onClick={() => handleTabChange("account")}
            type="button"
          >
            🔐 Account
          </button>
        </div>

        {/* ── TAB: Clienti ── */}
        {activeTab === "clienti" && (
          <>
            <div className="cli-search-card">
              <div className="cli-search-label">Cerca cliente</div>
              <CustomerAutocomplete
                value={query}
                onChange={setQuery}
                onSelect={handleSelect}
                placeholder="Cerca per nome, telefono o email…"
              />
              {!selected && (
                <div className="cli-search-empty">
                  Cerca una cliente per nome, telefono o email.
                </div>
              )}
            </div>
            <div className="cli-layout">
              <ClientSummary
                customer={detail}
                loading={loading}
                error={summaryError}
                onNotesChange={handleNotesChange}
                onSettle={handleSettleArretrato}
              />
            </div>
          </>
        )}

        {/* ── TAB: Pacchetti ── */}
        {activeTab === "pacchetti" && (
          <div className="cli-pkg-panel">

            {pkgKpis && (
              <div className="cli-kpi-row mb-3">
                <div className="cli-kpi cli-kpi--ok">
                  <div className="cli-kpi-label">Pacchetti attivi</div>
                  <div className="cli-kpi-value">{pkgKpis.active}</div>
                </div>
                <div className="cli-kpi cli-kpi--bad">
                  <div className="cli-kpi-label">Scaduti</div>
                  <div className="cli-kpi-value">{pkgKpis.expired}</div>
                </div>
                <div className="cli-kpi">
                  <div className="cli-kpi-label">Completati</div>
                  <div className="cli-kpi-value">{pkgKpis.completed}</div>
                </div>
              </div>
            )}

            <div className="cli-pkg-filters">
              {["ALL", "ACTIVE", "EXPIRING", "EXPIRED"].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`cli-pkg-ftab ${pkgFilter === f ? "is-active" : ""}`}
                  onClick={() => setPkgFilter(f)}
                >
                  {f === "ALL"      && "Tutti"}
                  {f === "ACTIVE"   && "Attivi"}
                  {f === "EXPIRING" && "⚠ In scadenza (≤30g)"}
                  {f === "EXPIRED"  && "Scaduti"}
                </button>
              ))}
              <input
                className="cli-pkg-search"
                placeholder="Cerca per email o servizio…"
                value={pkgSearch}
                onChange={e => setPkgSearch(e.target.value)}
              />
              <button
                type="button"
                className="cli-pkg-reload"
                onClick={() => { setPackages([]); setPkgKpis(null); loadPackages(); }}
                title="Ricarica"
              >
                ↻
              </button>
            </div>

            {pkgLoading && (
              <div className="d-flex justify-content-center py-5">
                <Spinner animation="border" size="sm" />
              </div>
            )}

            {pkgError && <div className="cli-error">{pkgError}</div>}

            {!pkgLoading && !pkgError && (() => {
              const filtered = packages.filter(p => {
                const days = daysUntilExpiry(p.expiryDate);
                const matchFilter =
                  pkgFilter === "ALL"      ? true :
                  pkgFilter === "ACTIVE"   ? (p.status === "ACTIVE" && (days === null || days > 30)) :
                  pkgFilter === "EXPIRING" ? (p.status === "ACTIVE" && days !== null && days >= 0 && days <= 30) :
                  pkgFilter === "EXPIRED"  ? p.status === "EXPIRED" :
                  true;

                const q = pkgSearch.toLowerCase();
                const matchSearch = !q || (
                  p.customerEmail?.toLowerCase().includes(q) ||
                  p.customerName?.toLowerCase().includes(q) ||
                  p.serviceName?.toLowerCase().includes(q) ||
                  p.serviceOptionName?.toLowerCase().includes(q)
                );

                return matchFilter && matchSearch;
              });

              if (!filtered.length) return (
                <div className="cli-empty-history" style={{ padding: "3rem 0", textAlign: "center" }}>
                  Nessun pacchetto trovato.
                </div>
              );

              return (
                <div className="cli-pkg-global-list">
                  {filtered.map(p => {
                    const tag   = expiryTag(p.expiryDate);
                    const ratio = p.sessionsTotal > 0 ? p.sessionsRemaining / p.sessionsTotal : 0;
                    const pct   = Math.round(ratio * 100);
                    let barCls  = "cli-pkg-bar-fill--good";
                    if (p.sessionsRemaining <= 1) barCls = "cli-pkg-bar-fill--critical";
                    else if (pct <= 50)           barCls = "cli-pkg-bar-fill--warn";

                    return (
                      <div key={p.packageCreditId} className={`cli-pkg-global-card ${p.status === "EXPIRED" ? "is-expired" : ""}`}>
                        <div className="cli-pkg-global-left">
                          <div className="cli-pkg-global-name">
                            {p.serviceName || "Servizio"}
                            {p.serviceOptionName && <span className="cli-pkg-option"> · {p.serviceOptionName}</span>}
                          </div>
                          <div className="cli-pkg-global-customer">
                            {p.customerName || p.customerEmail}
                            {p.customerPhone && (
                              <button
                                className="cli-wa-btn cli-wa-btn--sm"
                                type="button"
                                onClick={() => openWhatsApp(p.customerPhone)}
                              >
                                💬
                              </button>
                            )}
                          </div>
                          <div className="cli-pkg-global-email">{p.customerEmail}</div>
                        </div>

                        <div className="cli-pkg-global-center">
                          <div className="cli-pkg-bar" style={{ width: "120px" }}>
                            <div className={`cli-pkg-bar-fill ${barCls}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="cli-pkg-meta">
                            {p.sessionsRemaining}/{p.sessionsTotal} sedute
                          </div>
                        </div>

                        <div className="cli-pkg-global-right">
                          {tag && <span className={tag.cls}>{tag.label}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── TAB: Account ── */}
        {activeTab === "account" && (
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
                              href={`https://wa.me/39${u.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Ciao ${u.name}, ti scrivo da Beauty Room.`)}`}
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
        )}

      </Container>
    </div>
  );
}
