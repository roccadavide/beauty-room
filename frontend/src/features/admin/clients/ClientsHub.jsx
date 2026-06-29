import { useCallback, useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import { getCustomerSummary, updateCustomerNotes } from "../../../api/modules/customer.api";
import { settleBookingLines } from "../../../api/modules/adminAgenda.api";
import SEO from "../../../components/common/SEO";
import { buildArretratoSettlePayload } from "../../../components/admin/settlePayload";
import WorkspaceSwitch from "../WorkspaceSwitch";
import ClientSearch from "./ClientSearch";
import ClientDetailPanel from "./ClientDetailPanel";
import PackagesGlobal from "./PackagesGlobal";
import AccountsPanel from "./AccountsPanel";
import ClientsOverview from "./ClientsOverview";

/**
 * Clients view of the AdminWorkspace. Composes the Phase-2 components (search +
 * detail + packages + accounts) and prepends the Panoramica dashboard. Owns the
 * customer-selection state lifted out of the standalone ClientiPage; the deep-link
 * arrives as the `customerId` prop (AdminWorkspace passes the ?customerId= param).
 *
 * Note: this duplicates a little of ClientiPage's composer shell on purpose —
 * Phase 4 deletes ClientiPage and redirects here, collapsing the duplication.
 */
export default function ClientsHub({ customerId }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Land on Clienti (with the detail panel) when arriving via a deep-link;
  // otherwise show the Panoramica dashboard first.
  const [activeSubTab, setActiveSubTab] = useState(customerId ? "clienti" : "panoramica");
  // Kept solely to drive the "Pacchetti attivi" tab badge — PackagesGlobal owns
  // the authoritative KPI state and lifts it up here.
  const [pkgKpis, setPkgKpis] = useState(null);

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

  const handleNotesChange = useCallback(async (cid, notes) => {
    await updateCustomerNotes(cid, notes);
    setDetail(prev => (prev ? { ...prev, notes } : prev));
  }, []);

  // Refetch the open customer so a settled arretrato drops out of the panel.
  const reloadDetail = useCallback(async () => {
    const id = detail?.customerId;
    if (!id) return;
    const data = await getCustomerSummary(id);
    setDetail(data);
  }, [detail?.customerId]);

  // Settle ONE arretrato line. The booking is already COMPLETED → alsoComplete:false.
  // settleBookingLines may throw → the row handler keeps the row and shows the error;
  // a post-settle reload failure is swallowed (settle succeeded).
  const handleSettleArretrato = useCallback(async a => {
    await settleBookingLines(a.bookingId, buildArretratoSettlePayload(a));
    try { await reloadDetail(); } catch { /* settle ok; next open refreshes */ }
  }, [reloadDetail]);

  // Select a customer by id alone — used by the deep-link and by the overview
  // ranking rows. Switches to the Clienti sub-tab so the detail panel is visible.
  // A stale/unknown id is swallowed (no selection, no crash).
  const loadCustomerById = useCallback(async id => {
    if (!id) return;
    setActiveSubTab("clienti");
    setError("");
    setLoading(true);
    try {
      const data = await getCustomerSummary(id);
      setSelected({ customerId: id, fullName: data.fullName });
      setDetail(data);
    } catch {
      setSelected(null);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Deep-link from the OUTSTANDING_PAYMENT notification, re-homed from ClientiPage:
  // AdminWorkspace passes ?customerId= through as a prop. Re-runs if it changes.
  useEffect(() => {
    if (customerId) loadCustomerById(customerId);
  }, [customerId, loadCustomerById]);

  return (
    <div className="cli-page">
      <SEO title="Clienti" noindex={true} />
      <Container className="cli-container">
        <header className="cli-header">
          <div className="cli-header__top">
            <div>
              <h1 className="cli-title">Gestione</h1>
              <p className="cli-subtitle">Clienti, pacchetti attivi e storico prenotazioni</p>
            </div>
            <WorkspaceSwitch />
          </div>
        </header>

        {/* ── Sub-tab switcher ── */}
        <div className="cli-tabs">
          <button
            className={`cli-tab ${activeSubTab === "panoramica" ? "is-active" : ""}`}
            onClick={() => setActiveSubTab("panoramica")}
            type="button"
          >
            📊 Panoramica
          </button>
          <button
            className={`cli-tab ${activeSubTab === "clienti" ? "is-active" : ""}`}
            onClick={() => setActiveSubTab("clienti")}
            type="button"
          >
            👤 Clienti
          </button>
          <button
            className={`cli-tab ${activeSubTab === "pacchetti" ? "is-active" : ""}`}
            onClick={() => setActiveSubTab("pacchetti")}
            type="button"
          >
            📦 Pacchetti attivi
            {pkgKpis?.active > 0 && <span className="cli-tab-badge">{pkgKpis.active}</span>}
          </button>
          <button
            className={`cli-tab ${activeSubTab === "account" ? "is-active" : ""}`}
            onClick={() => setActiveSubTab("account")}
            type="button"
          >
            🔐 Account
          </button>
        </div>

        {/* ── TAB: Panoramica ── */}
        {activeSubTab === "panoramica" && (
          <ClientsOverview onSelectCustomer={loadCustomerById} />
        )}

        {/* ── TAB: Clienti ── */}
        {activeSubTab === "clienti" && (
          <>
            <ClientSearch
              value={query}
              onChange={setQuery}
              onSelect={handleSelect}
              hasSelection={!!selected}
            />
            <div className="cli-layout">
              <ClientDetailPanel
                customer={detail}
                loading={loading}
                error={error}
                onNotesChange={handleNotesChange}
                onSettle={handleSettleArretrato}
              />
            </div>
          </>
        )}

        {/* ── TAB: Pacchetti ── */}
        {activeSubTab === "pacchetti" && <PackagesGlobal onKpisChange={setPkgKpis} />}

        {/* ── TAB: Account ── */}
        {activeSubTab === "account" && <AccountsPanel />}
      </Container>
    </div>
  );
}
