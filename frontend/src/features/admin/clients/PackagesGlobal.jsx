import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import { fetchActivePackages, fetchPackageKpis } from "../../../api/modules/packages.api";
import { daysUntilExpiry, expiryTag, openWhatsApp } from "./clientsHelpers";

// Self-contained "Pacchetti" tab. Owns its own state and loads on mount.
// `onKpisChange` lifts the KPI object up so the parent tab switcher can keep
// showing the `cli-tab-badge` (active count) — the only piece the parent needs.
export default function PackagesGlobal({ onKpisChange }) {
  const [packages, setPackages]     = useState([]);
  const [pkgKpis, setPkgKpis]       = useState(null);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [pkgError, setPkgError]     = useState("");
  const [pkgFilter, setPkgFilter]   = useState("ALL");
  const [pkgSearch, setPkgSearch]   = useState("");

  // Guard kept verbatim from the original: the ↻ reload calls loadPackages()
  // while `packages.length > 0`, so it returns early — reload only CLEARS the
  // list (it does not re-fetch). On a fresh mount `packages` is empty, so this
  // load runs. Dropping the guard would change the reload button's behavior.
  const loadPackages = useCallback(async () => {
    if (packages.length > 0) return;
    setPkgLoading(true);
    setPkgError("");
    try {
      const [list, kpis] = await Promise.all([fetchActivePackages(), fetchPackageKpis()]);
      setPackages(list);
      setPkgKpis(kpis);
      onKpisChange?.(kpis);
    } catch (e) {
      setPkgError(e.message || "Errore caricamento pacchetti.");
    } finally {
      setPkgLoading(false);
    }
  }, [packages.length, onKpisChange]);

  // One-time load on mount (replaces the parent's lazy loader). The ref guard
  // keeps it to a single fetch even under StrictMode double-invoke.
  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    loadPackages();
  }, [loadPackages]);

  return (
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
          onClick={() => { setPackages([]); setPkgKpis(null); onKpisChange?.(null); loadPackages(); }}
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
  );
}
