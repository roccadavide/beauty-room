import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Container } from "react-bootstrap";
import { getCustomerSummary, updateCustomerNotes } from "../../api/modules/customer.api";
import { settleBookingLines } from "../../api/modules/adminAgenda.api";
import SEO from "../../components/common/SEO";
import { buildArretratoSettlePayload } from "../../components/admin/settlePayload";
import ClientSearch from "../../features/admin/clients/ClientSearch";
import ClientDetailPanel from "../../features/admin/clients/ClientDetailPanel";
import PackagesGlobal from "../../features/admin/clients/PackagesGlobal";
import AccountsPanel from "../../features/admin/clients/AccountsPanel";

export default function ClientiPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("clienti");
  // Kept in the parent solely to drive the "Pacchetti attivi" tab badge.
  // PackagesGlobal owns the authoritative KPI state and lifts it up here.
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

  const handleTabChange = useCallback(tab => {
    setActiveTab(tab);
  }, []);

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
                error={summaryError}
                onNotesChange={handleNotesChange}
                onSettle={handleSettleArretrato}
              />
            </div>
          </>
        )}

        {/* ── TAB: Pacchetti ── */}
        {activeTab === "pacchetti" && (
          <PackagesGlobal onKpisChange={setPkgKpis} />
        )}

        {/* ── TAB: Account ── */}
        {activeTab === "account" && (
          <AccountsPanel />
        )}

      </Container>
    </div>
  );
}
