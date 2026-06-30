import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { fetchCustomerInsights } from "../../../api/modules/customer.api";
import { fetchActivePackages } from "../../../api/modules/packages.api";
import { formatEuro } from "../../../utils/formatEuro";
import { openWhatsApp, daysUntilExpiry, expiryTag } from "./clientsHelpers";

// LocalDate ("2026-02-15") → "15 feb 2026". The "T00:00:00" suffix forces a
// LOCAL parse so the date never shifts a day across the UTC boundary.
const formatDateIT = iso =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// One leaderboard. `rows` come pre-ranked from the backend (top 5). A row is
// clickable only when it resolved to a real customerId — name-only rows (some
// in-store package attributions) render muted and non-interactive.
function RankingBlock({ title, rows, renderValue, onSelectCustomer, withWhatsApp, emptyHint }) {
  return (
    <section className="cov-block">
      <h3 className="cov-block__title">{title}</h3>
      {!rows?.length ? (
        <div className="cov-empty">{emptyHint || "—"}</div>
      ) : (
        <ol className="cov-rank">
          {rows.map((r, i) => {
            const canClick = r.customerId != null;
            const select = canClick ? () => onSelectCustomer(r.customerId) : undefined;
            return (
              <li
                key={`${r.customerId || r.name || "row"}-${i}`}
                className={`cov-rank__row${canClick ? " is-click" : " is-static"}${
                  withWhatsApp ? " cov-rank__row--wa" : ""
                }`}
                role={canClick ? "button" : undefined}
                tabIndex={canClick ? 0 : undefined}
                onClick={select}
                onKeyDown={
                  canClick
                    ? e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select();
                        }
                      }
                    : undefined
                }
              >
                <span className="cov-rank__pos">{i + 1}</span>
                <span className="cov-rank__id">
                  <span className="cov-rank__name">{r.name || "—"}</span>
                  {r.phone && <span className="cov-rank__phone">{r.phone}</span>}
                </span>
                <span className="cov-rank__val">{renderValue(r)}</span>
                {withWhatsApp && r.phone && (
                  <button
                    type="button"
                    className="cli-wa-btn"
                    title="Scrivi su WhatsApp"
                    onClick={e => {
                      e.stopPropagation();
                      openWhatsApp(r.phone);
                    }}
                  >
                    <span>💬</span>
                    <span>WhatsApp</span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function ClientsOverview({ onSelectCustomer }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Expiring packages: null = loading, [] = none-in-range / fetch failed (quiet),
  // [...] = rows. Re-homed from the removed Pacchetti tab — same /admin/packages,
  // narrowed client-side to online packages expiring within 30 days.
  const [expiring, setExpiring] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const d = await fetchCustomerInsights();
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e.message || "Errore caricamento panoramica.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Second, independent fetch — never blocks the insights view. A failure or an
  // empty range collapses to a quiet empty state ([]), not an error banner.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchActivePackages();
        if (cancelled) return;
        const rows = (Array.isArray(list) ? list : [])
          .map(p => ({ ...p, _days: daysUntilExpiry(p.expiryDate) }))
          .filter(p => p._days !== null && p._days >= 0 && p._days <= 30)
          .sort((a, b) => a._days - b._days);
        setExpiring(rows);
      } catch {
        if (!cancelled) setExpiring([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="cov-loading">
        <Spinner animation="border" size="sm" /> Caricamento panoramica…
      </div>
    );
  }
  if (error) return <div className="cov-error">{error}</div>;
  if (!data) return null;

  const stats = [
    { label: "Clienti totali", value: data.totalCustomers ?? 0, icon: "👥" },
    { label: "Clienti fidate", value: data.trustedCustomersCount ?? 0, icon: "✦" },
    { label: "Pacchetti attivi", value: data.activePackagesCount ?? 0, icon: "📦" },
    { label: "Da incassare", value: formatEuro(data.outstandingTotal ?? 0), accent: true, icon: "💰" },
  ];

  return (
    <div className="cov">
      <div className="cov-stats">
        {stats.map(s => (
          <div key={s.label} className={`cov-stat${s.accent ? " cov-stat--accent" : ""}`}>
            <span className="cov-stat__icon" aria-hidden="true">{s.icon}</span>
            <div className="cov-stat__body">
              <div className="cov-stat__value">{s.value}</div>
              <div className="cov-stat__label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pacchetti in scadenza — actionable block re-homed from the removed
          Pacchetti tab. Online packages only (in-store have no expiry). */}
      <section className="cov-exp">
        <h3 className="cov-exp__title">Pacchetti in scadenza</h3>
        {expiring === null ? (
          <div className="cov-exp__skeleton" aria-hidden="true">
            <span className="cov-exp__sk" />
            <span className="cov-exp__sk" />
            <span className="cov-exp__sk" />
          </div>
        ) : expiring.length === 0 ? (
          <div className="cov-empty">Nessun pacchetto in scadenza nei prossimi 30 giorni.</div>
        ) : (
          <ul className="cov-exp__list">
            {expiring.map(p => {
              const tag = expiryTag(p.expiryDate);
              return (
                <li key={p.packageCreditId} className="cov-exp__row">
                  <div className="cov-exp__id">
                    <span className="cov-exp__name">{p.customerName || p.customerEmail || "Cliente"}</span>
                    <span className="cov-exp__pkg">
                      {p.serviceName || "Pacchetto"}
                      {p.serviceOptionName && <span className="cov-exp__opt"> · {p.serviceOptionName}</span>}
                    </span>
                  </div>
                  {tag && <span className={tag.cls}>{tag.label}</span>}
                  {p.customerPhone && (
                    <button
                      type="button"
                      className="cli-wa-btn"
                      title="Ricorda su WhatsApp"
                      onClick={() => openWhatsApp(p.customerPhone)}
                    >
                      <span>💬</span>
                      <span>Ricorda</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="cov-grid">
        <RankingBlock
          title="Più appuntamenti"
          rows={data.topByCompletedAppointments}
          onSelectCustomer={onSelectCustomer}
          renderValue={r => <>{r.count}</>}
          emptyHint="Nessun appuntamento completato."
        />
        <RankingBlock
          title="Più pacchetti"
          rows={data.topByPackages}
          onSelectCustomer={onSelectCustomer}
          renderValue={r => <>{r.count}</>}
          emptyHint="Nessun pacchetto."
        />
        <RankingBlock
          title="Più spesa"
          rows={data.topBySpend}
          onSelectCustomer={onSelectCustomer}
          renderValue={r => (
            <>
              {formatEuro(r.revenue)}
              {r.visits != null && <small>{r.visits} visite</small>}
            </>
          )}
          emptyHint="Nessun incasso registrato."
        />
        <RankingBlock
          title="Da risentire"
          rows={data.winBack}
          onSelectCustomer={onSelectCustomer}
          withWhatsApp
          renderValue={r => (
            <>
              {r.daysSince} giorni fa
              <small>{formatDateIT(r.lastVisit)}</small>
            </>
          )}
          emptyHint="Nessuna cliente da risentire."
        />
      </div>
    </div>
  );
}
