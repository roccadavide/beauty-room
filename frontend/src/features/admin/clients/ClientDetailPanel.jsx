import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import { getActivePackages, fetchCustomerBookings } from "../../../api/modules/customer.api";
import { cancelPackageAssignment } from "../../../api/modules/adminAgenda.api";
import { formatEuro } from "../../../utils/formatEuro";
import EditPackageModal from "./EditPackageModal";
import CustomerBookingRow from "./CustomerBookingRow";
import { earliestBookingDate, formatDateTimeIT, formatDateShortIT, openWhatsApp, groupByMonthYear, deriveCustomerStatus } from "./clientsHelpers";
import "./ClientDetailPanel.css";

const STATUS_CHIP_LABEL = { nuovo: "Nuovo", attivo: "Attivo", "da-risentire": "Da risentire" };

// Package progress bar — width % + tone class. Same thresholds as before:
// remaining<=1 critical, pct<=50 warn, else good. Pure/presentation.
function pkgBar(remaining, total) {
  const ratio = total > 0 ? remaining / total : 0;
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  let cls = "cli-pkg-bar-fill--good";
  if (remaining <= 1) cls = "cli-pkg-bar-fill--critical";
  else if (pct <= 50) cls = "cli-pkg-bar-fill--warn";
  return { pct, cls };
}

// Initials from a full name (first two words) for the hero avatar.
function initialsFromName(name) {
  return (
    (name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join("") || "?"
  );
}

export default function ClientDetailPanel({ customer, loading, error, onNotesChange, onSettle, onEditBooking, onNewAppointment, bookingsRefreshKey }) {
  const [notes, setNotes] = useState(customer?.notes || "");
  const [originalNotes, setOriginalNotes] = useState(customer?.notes || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedOk, setSavedOk] = useState(false);
  const saveTimerRef = useRef(null);

  // Tap-to-copy phone/email — transient "copiato ✓" ('phone' | 'email' | null).
  const [copied, setCopied] = useState(null);
  const copyTimerRef = useRef(null);

  const [inStorePkgs, setInStorePkgs] = useState([]);
  const [inStorePkgsLoading, setInStorePkgsLoading] = useState(false);
  const [pkgError, setPkgError] = useState("");
  const [editPkg, setEditPkg] = useState(null);
  const [deletePkgId, setDeletePkgId] = useState(null);

  // ── Rich, agenda-shaped booking history (replaces the thin customer.bookings) ──
  // upcoming = clickable → edit; past = read-only with growing "Carica altri".
  const [richBookings, setRichBookings] = useState({ upcoming: [], past: [], pastTotal: 0 });
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [pastLimit, setPastLimit] = useState(20);

  // ── Arretrati per-row settle ──
  const [settlingKey, setSettlingKey] = useState(null); // row in flight → blocks double-click
  const [flashKey, setFlashKey] = useState(null); // optimistic "Saldato ✓" before refetch
  const [errorKey, setErrorKey] = useState(null); // last row whose settle failed
  const [confirmArretrato, setConfirmArretrato] = useState(null); // row awaiting confirm

  // The panel is reused (not remounted) across customers → clear per-row state on switch.
  useEffect(() => {
    setSettlingKey(null);
    setFlashKey(null);
    setErrorKey(null);
    setConfirmArretrato(null);
    setPastLimit(20); // reset the "Carica altri" window for the new customer
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
      setErrorKey(key); // …keep the row "da saldare" and surface the error
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
    if (!customer?.customerId) {
      setInStorePkgs([]);
      return;
    }
    setInStorePkgsLoading(true);
    setPkgError("");
    getActivePackages(customer.customerId)
      .then(data => setInStorePkgs(data))
      .catch(e => setPkgError(e.message || "Errore caricamento pacchetti in sede."))
      .finally(() => setInStorePkgsLoading(false));
  }, [customer?.customerId]);

  // Rich booking history. Re-fetches when the customer changes, after a save
  // (bookingsRefreshKey bumped by the hub), or when "Carica altri" grows pastLimit.
  useEffect(() => {
    const id = customer?.customerId;
    if (!id) {
      setRichBookings({ upcoming: [], past: [], pastTotal: 0 });
      return;
    }
    let cancelled = false;
    setBookingsLoading(true);
    setBookingsError("");
    fetchCustomerBookings(id, pastLimit)
      .then(data => {
        if (!cancelled) setRichBookings(data);
      })
      .catch(e => {
        if (!cancelled) setBookingsError(e.message || "Errore caricamento storico.");
      })
      .finally(() => {
        if (!cancelled) setBookingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer?.customerId, bookingsRefreshKey, pastLimit]);

  useEffect(
    () => () => {
      clearTimeout(saveTimerRef.current);
      clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const copyToClipboard = (text, which) => {
    if (!text || !navigator.clipboard?.writeText) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(which);
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => {
        /* clipboard blocked — silently no-op */
      });
  };

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
    setInStorePkgs(prev => prev.map(p => (p.id === updated.id ? updated : p)));
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

  // Best-effort trust flag: trust is authoritative on the linked User and is
  // toggled in the Account tab. We surface it here per-booking (customerVerified
  // is derived from user.isVerified/linkedUser.isVerified on each card) — true if
  // ANY of this customer's bookings carry a verified account.
  const isTrusted = [...richBookings.upcoming, ...richBookings.past].some(c => c.customerVerified === true);

  const notesChanged = notes !== (originalNotes || "");

  // Derived, presentation-only signals from the already-fetched rich history.
  const initials = initialsFromName(customer.fullName);
  // past is newest-first → first COMPLETED is the most recent visit.
  const lastVisitIso = richBookings.past.find(c => (c.bookingStatus ?? c.status) === "COMPLETED")?.startTime || null;
  const nextIso = richBookings.upcoming[0]?.startTime || null;
  const hasUpcoming = richBookings.upcoming.length > 0;
  // Show the state chip only once the rich history is available (avoid a wrong
  // chip mid-load); stays stable across "Carica altri" since past keeps its data.
  const richReady = !bookingsLoading || richBookings.upcoming.length > 0 || richBookings.past.length > 0;
  const statusKey = richReady
    ? deriveCustomerStatus({
        firstBookingDate,
        lastVisitDate: lastVisitIso ? new Date(lastVisitIso) : null,
        hasUpcoming,
      })
    : null;

  const upcomingGroups = groupByMonthYear(richBookings.upcoming);
  const pastGroups = groupByMonthYear(richBookings.past);
  const onlinePkgs = inStorePkgs.filter(p => p.source === "ONLINE");
  const adminPkgs = inStorePkgs.filter(p => p.source === "ADMIN");

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
    <div className="cdp-root">
      {error && <div className="cli-error">{error}</div>}

      {/* ── ZONE A — Hero (identity + primary actions; sticky on desktop) ── */}
      <header className="cdp-hero">
        <div className="cdp-hero__main">
          <div className="cdp-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="cdp-hero__id">
            <h2 className="cdp-name">{customer.fullName || "—"}</h2>

            <div className="cdp-badges">
              {statusKey && <span className={`cdp-chip cdp-chip--${statusKey}`}>{STATUS_CHIP_LABEL[statusKey]}</span>}
              {isTrusted && <span className="cdp-chip cdp-chip--trust">✦ Cliente di fiducia</span>}
              {firstYear && <span className="cdp-chip cdp-chip--year">Cliente dal {firstYear}</span>}
            </div>

            <div className="cdp-contacts">
              {customer.phone ? (
                <button type="button" className="cdp-contact" title="Tocca per copiare" onClick={() => copyToClipboard(customer.phone, "phone")}>
                  <span className="cdp-contact__icon">📱</span>
                  <span className="cdp-contact__text">{customer.phone}</span>
                  <span className="cdp-contact__copied">{copied === "phone" ? "copiato ✓" : ""}</span>
                </button>
              ) : (
                <span className="cdp-contact cdp-contact--empty">📱 Telefono non indicato</span>
              )}
              {customer.phone && (
                <button type="button" className="cli-wa-btn" onClick={() => openWhatsApp(customer.phone)} title="Apri su WhatsApp">
                  <span>💬</span>
                  <span>WhatsApp</span>
                </button>
              )}
              {customer.email && (
                <button type="button" className="cdp-contact" title="Tocca per copiare" onClick={() => copyToClipboard(customer.email, "email")}>
                  <span className="cdp-contact__icon">✉</span>
                  <span className="cdp-contact__text">{customer.email}</span>
                  <span className="cdp-contact__copied">{copied === "email" ? "copiato ✓" : ""}</span>
                </button>
              )}
            </div>

            {firstWhen && <div className="cdp-firstseen">Prima prenotazione · {firstWhen}</div>}
          </div>
        </div>

        <div className="cdp-hero__actions">
          <button type="button" className="cli-btn cdp-cta" onClick={onNewAppointment}>
            ➕ Nuovo appuntamento
          </button>
          {customer.phone && (
            <button type="button" className="cdp-action-wa" onClick={() => openWhatsApp(customer.phone)} title="Apri su WhatsApp" aria-label="Apri su WhatsApp">
              💬
            </button>
          )}
        </div>
      </header>

      {/* ── ZONE B — KPI strip ── */}
      <div className="cdp-kpis">
        <div className="cdp-kpi">
          <span className="cdp-kpi__value">{customer.totalBookings}</span>
          <span className="cdp-kpi__label">Totale</span>
        </div>
        <div className="cdp-kpi cdp-kpi--ok">
          <span className="cdp-kpi__value">{customer.completedBookings}</span>
          <span className="cdp-kpi__label">Completati</span>
        </div>
        <div className="cdp-kpi cdp-kpi--bad">
          <span className="cdp-kpi__value">{customer.cancelledBookings}</span>
          <span className="cdp-kpi__label">Cancellati</span>
        </div>
        <div className="cdp-kpi">
          <span className="cdp-kpi__value cdp-kpi__value--date">{lastVisitIso ? formatDateShortIT(lastVisitIso) : "—"}</span>
          <span className="cdp-kpi__label">Ultima visita</span>
        </div>
        <div className="cdp-kpi">
          <span className="cdp-kpi__value cdp-kpi__value--date">{nextIso ? formatDateShortIT(nextIso) : "—"}</span>
          <span className="cdp-kpi__label">Prossimo</span>
        </div>
      </div>

      {/* ── ZONE C — Body: main timeline + side ── */}
      <div className="cdp-body">
        {/* MAIN — Prossimi + Storico as a vertical timeline */}
        <main className="cdp-main" style={{ padding: "0" }}>
          {/* Prossimi appuntamenti — clickable → open the drawer in edit. Each row
              is a full AdminBookingCardDTO, handed straight to the edit flow. */}
          <section className="cdp-tl-section cdp-tl-section--upcoming">
            <div className="cdp-tl-section__head">
              <h3 className="cdp-tl-section__title">Prossimi appuntamenti</h3>
              {richBookings.upcoming.length > 0 && <span className="cdp-tl-section__count">{richBookings.upcoming.length}</span>}
            </div>
            {bookingsError && <div className="cli-error">{bookingsError}</div>}
            {bookingsLoading && richBookings.upcoming.length === 0 ? (
              <div className="cli-loading" style={{ padding: "8px 0" }}>
                <Spinner animation="border" size="sm" />
              </div>
            ) : richBookings.upcoming.length ? (
              <div className="cdp-timeline cdp-timeline--gold">
                {upcomingGroups.map(g => (
                  <div className="cdp-tl-group" key={`u-${g.label}`}>
                    <div className="cdp-tl-group__label">{g.label}</div>
                    {g.items.map(c => (
                      <div className="cdp-tl-node cdp-tl-node--upcoming" key={c.bookingId}>
                        <span className="cdp-tl-node__dot" aria-hidden="true" />
                        <CustomerBookingRow card={c} clickable onClick={onEditBooking} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="cdp-empty">Nessun appuntamento in programma.</div>
            )}
          </section>

          {/* Storico — read-only rich rows, most-recent first, with "Carica altri". */}
          <section className="cdp-tl-section cdp-tl-section--past">
            <div className="cdp-tl-section__head">
              <h3 className="cdp-tl-section__title">Storico</h3>
              {richBookings.pastTotal > 0 && <span className="cdp-tl-section__count">{richBookings.pastTotal}</span>}
            </div>
            {richBookings.past.length ? (
              <>
                <div className="cdp-timeline">
                  {pastGroups.map(g => (
                    <div className="cdp-tl-group" key={`p-${g.label}`}>
                      <div className="cdp-tl-group__label">{g.label}</div>
                      {g.items.map(c => (
                        <div className="cdp-tl-node cdp-tl-node--past" key={c.bookingId}>
                          <span className="cdp-tl-node__dot" aria-hidden="true" />
                          <CustomerBookingRow card={c} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {richBookings.past.length < richBookings.pastTotal && (
                  <div className="cbr-loadmore">
                    <button type="button" className="cli-btn cli-btn--sm cli-btn--ghost" disabled={bookingsLoading} onClick={() => setPastLimit(n => n + 20)}>
                      {bookingsLoading ? "Caricamento…" : "Carica altri"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="cdp-empty">{bookingsLoading ? "Caricamento…" : "Nessuna prenotazione passata."}</div>
            )}
          </section>
        </main>

        {/* SIDE — note, pacchetti, arretrati */}
        <aside className="cdp-side">
          {/* Note cliente */}
          <section className="cdp-zone">
            <div className="cdp-zone__head">
              <h3 className="cdp-zone__title">Note cliente</h3>
              <span className="cdp-zone__meta">{notes.length}/2000</span>
            </div>
            <textarea className="cli-notes-textarea" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />
            <div className="cli-notes-actions">
              <button className="cli-btn cli-btn--sm" disabled={!notesChanged || saving} onClick={handleSaveNotes}>
                {saving ? "Salvataggio…" : "Salva note"}
              </button>
              {savedOk && <span className="cli-save-ok">✓ Salvato</span>}
            </div>
            {saveError && <div className="cli-notes-error">{saveError}</div>}
          </section>

          {/* Pacchetti — online (Stripe, FK-bridged, read-only) e in sede (admin,
              ✏/🗑). Stesso endpoint /active-packages; `source` li separa. */}
          {pkgError && <div className="cli-error">{pkgError}</div>}
          {(inStorePkgsLoading || onlinePkgs.length > 0 || adminPkgs.length > 0) && (
            <section className="cdp-zone">
              <div className="cdp-zone__head">
                <h3 className="cdp-zone__title">Pacchetti</h3>
              </div>

              {inStorePkgsLoading && (
                <div className="cli-loading" style={{ padding: "8px 0" }}>
                  <Spinner animation="border" size="sm" />
                </div>
              )}

              {!inStorePkgsLoading && onlinePkgs.length > 0 && (
                <div className="cdp-pkg-group">
                  <div className="cdp-pkg-group__label">Online</div>
                  <div className="cli-packages">
                    {onlinePkgs.map(p => {
                      const total = p.totalSessions || 0;
                      const remaining = p.sessionsRemaining || 0;
                      const { pct, cls } = pkgBar(remaining, total);
                      const expiry = p.expiryDate
                        ? new Date(p.expiryDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
                        : null;
                      return (
                        <div key={p.id} className="cli-pkg-card">
                          <div className="cli-pkg-name">{p.displayName || p.serviceTitle || "Pacchetto"}</div>
                          <div className="cli-pkg-bar">
                            <div className={`cli-pkg-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
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

              {!inStorePkgsLoading && adminPkgs.length > 0 && (
                <div className="cdp-pkg-group">
                  <div className="cdp-pkg-group__label">In sede</div>
                  <div className="cli-packages">
                    {adminPkgs.map(p => {
                      const total = p.totalSessions || 0;
                      const remaining = p.sessionsRemaining || 0;
                      const { pct, cls } = pkgBar(remaining, total);
                      return (
                        <div key={p.id} className="cli-pkg-card cli-pkg-card--instore">
                          <div className="cli-pkg-card-header">
                            <div className="cli-pkg-name">{p.displayName || p.serviceOptionName || "Pacchetto"}</div>
                            <div className="cli-pkg-actions">
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
                            <div className={`cli-pkg-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="cli-pkg-meta">
                            <span>
                              {remaining} / {total} sedute rimanenti
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Arretrati / Da saldare — only when present. Backend-derived
              (customer.arretrati): no FE recompute/total. Per-row settle. */}
          {customer.arretrati?.length > 0 && (
            <section className="cdp-zone cdp-zone--alert">
              <div className="cdp-zone__head">
                <h3 className="cdp-zone__title">Arretrati · Da saldare</h3>
              </div>
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
                        <div className="cli-history-status" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {flashed ? (
                            <span className="cli-save-ok">Saldato ✓</span>
                          ) : (
                            <>
                              <span>{formatEuro(a.price)}</span>
                              <button type="button" className="cli-btn cli-btn--sm" disabled={settlingKey !== null} onClick={() => setConfirmArretrato(a)}>
                                {busy ? "…" : errored ? "Riprova" : "Salda"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {errored && <div className="cli-notes-error">Errore nel salvataggio. La riga resta da saldare.</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* ── Modals — mounting unchanged (EditPackageModal = inline position:fixed
          .ep-backdrop; ConfirmDialogs = portaled to document.body) ── */}
      {editPkg && <EditPackageModal pkg={editPkg} onClose={() => setEditPkg(null)} onSave={handlePkgSaved} />}

      <ConfirmDialog
        show={!!deletePkgId}
        onHide={() => setDeletePkgId(null)}
        onConfirm={handleDeletePkg}
        title="Cancella pacchetto"
        message="Sei sicura di voler cancellare questo pacchetto in sede? Le sedute già usate rimarranno nello storico prenotazioni."
        confirmLabel="Cancella"
        confirmVariant="danger"
      />

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
    </div>
  );
}
