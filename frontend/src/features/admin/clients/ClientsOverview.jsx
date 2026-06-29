import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { fetchCustomerInsights } from "../../../api/modules/customer.api";
import { formatEuro } from "../../../utils/formatEuro";
import { openWhatsApp } from "./clientsHelpers";

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
                    className="cov-wa"
                    title="Scrivi su WhatsApp"
                    onClick={e => {
                      e.stopPropagation();
                      openWhatsApp(r.phone);
                    }}
                  >
                    WhatsApp
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
    { label: "Clienti totali", value: data.totalCustomers ?? 0 },
    { label: "Clienti fidate", value: data.trustedCustomersCount ?? 0 },
    { label: "Pacchetti attivi", value: data.activePackagesCount ?? 0 },
    { label: "Da incassare", value: formatEuro(data.outstandingTotal ?? 0), accent: true },
  ];

  return (
    <div className="cov">
      <div className="cov-stats">
        {stats.map(s => (
          <div key={s.label} className={`cov-stat${s.accent ? " cov-stat--accent" : ""}`}>
            <div className="cov-stat__value">{s.value}</div>
            <div className="cov-stat__label">{s.label}</div>
          </div>
        ))}
      </div>

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
