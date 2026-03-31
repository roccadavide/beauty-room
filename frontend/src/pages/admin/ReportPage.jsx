import { useCallback, useEffect, useMemo, useState } from "react";
import { Container, Spinner } from "react-bootstrap";
import { getReport } from "../../api/modules/report.api";
import DateTimeField from "../../components/common/DateTimeField";

const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const fmtCurrency = value => (value ?? 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

function currentYearRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-01-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function addMonths(date, delta) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

function formatMonthLabel(year, month) {
  return `${MONTH_LABELS[month - 1]} ${String(year).slice(-2)}`;
}

function ReportPage() {
  const { from: defaultFrom, to: defaultTo } = useMemo(() => currentYearRange(), []);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [activeShortcut, setActiveShortcut] = useState("YEAR");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (f, t) => {
    setLoading(true);
    setError("");
    try {
      const payload = await getReport(f, t);
      setData(payload);
    } catch (e) {
      setError(e.message || "Errore caricamento report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(from, to);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyShortcut = key => {
    const now = new Date();
    let fromD;
    let toD = now;
    switch (key) {
      case "M1":
        fromD = addMonths(now, -1);
        break;
      case "M3":
        fromD = addMonths(now, -3);
        break;
      case "M6":
        fromD = addMonths(now, -6);
        break;
      case "YEAR":
      default:
        fromD = new Date(now.getFullYear(), 0, 1);
        break;
    }
    const f = fromD.toISOString().slice(0, 10);
    const t = toD.toISOString().slice(0, 10);
    setFrom(f);
    setTo(t);
    setActiveShortcut(key);
    fetchData(f, t);
  };

  const handleManualUpdate = () => {
    setActiveShortcut(null);
    fetchData(from, to);
  };

  const monthly = data?.monthlyRevenue || [];
  const summary = data?.summary;
  const topServices = data?.topServices || [];
  const topClients = data?.topClients || [];

  const maxMonthly = monthly.reduce((max, m) => Math.max(max, Number(m.total ?? 0)), 0);

  const renderKpi = () => {
    if (!summary) return null;
    return (
      <div className="rep-kpi-row">
        <div className="rep-kpi">
          <div className="rep-kpi-label">Ricavo totale</div>
          <div className="rep-kpi-value">{fmtCurrency(summary.totalRevenue)}</div>
        </div>
        <div className="rep-kpi">
          <div className="rep-kpi-label">Trattamenti</div>
          <div className="rep-kpi-value">{fmtCurrency(summary.treatmentsRevenue)}</div>
          <div className="rep-kpi-sub">Prenotazioni completate: {summary.completedBookings}</div>
        </div>
        <div className="rep-kpi">
          <div className="rep-kpi-label">Prodotti</div>
          <div className="rep-kpi-value">{fmtCurrency(summary.productsRevenue)}</div>
        </div>
        <div className="rep-kpi">
          <div className="rep-kpi-label">Cancellati / No-show</div>
          <div className="rep-kpi-value">{summary.cancelledBookings}</div>
          <div className="rep-kpi-sub">Nuove clienti: {summary.newClientsCount}</div>
        </div>
      </div>
    );
  };

  const renderMonthlyChart = () => {
    if (!monthly.length) {
      return <div className="rep-empty">Nessun dato disponibile per il periodo selezionato.</div>;
    }

    return (
      <>
        <div className="rep-chart-wrapper">
          <div className="rep-chart">
            {monthly.map(m => {
              const key = `${m.year}-${m.month}`;
              const t = Number(m.treatments ?? 0);
              const p = Number(m.products ?? 0);
              const total = t + p;
              const denom = maxMonthly > 0 ? maxMonthly : 1;
              const totalPct = Math.max(0.05, total / denom);
              const tPct = total > 0 ? t / total : 0;
              const pPct = total > 0 ? p / total : 0;

              return (
                <div key={key} className="rep-bar-col" title={`${formatMonthLabel(m.year, m.month)} · ${fmtCurrency(m.total)}`}>
                  <div className="rep-bar-stack">
                    {total === 0 ? (
                      <div className="rep-bar-zero" />
                    ) : (
                      <>
                        {p > 0 && <div className="rep-bar-segment rep-bar-products" style={{ height: `${totalPct * 100 * pPct}%` }} />}
                        {t > 0 && <div className="rep-bar-segment rep-bar-treatments" style={{ height: `${totalPct * 100 * tPct}%` }} />}
                      </>
                    )}
                  </div>
                  <div className="rep-bar-label">{formatMonthLabel(m.year, m.month)}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rep-legend">
          <div className="rep-legend-item">
            <span className="rep-dot rep-dot--treat" /> Trattamenti
          </div>
          <div className="rep-legend-item">
            <span className="rep-dot rep-dot--prod" /> Prodotti
          </div>
        </div>
      </>
    );
  };

  const exportCsv = () => {
    if (!monthly.length) return;
    const lines = [
      "Mese;Trattamenti (€);Prodotti (€);Totale (€)",
      ...monthly.map(m => {
        const label = `${MONTH_LABELS[m.month - 1]} ${m.year}`;
        const t = Number(m.treatments ?? 0)
          .toFixed(2)
          .replace(".", ",");
        const p = Number(m.products ?? 0)
          .toFixed(2)
          .replace(".", ",");
        const tot = Number(m.total ?? 0)
          .toFixed(2)
          .replace(".", ",");
        return `${label};${t};${p};${tot}`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeFrom = from || "";
    const safeTo = to || "";
    a.download = `report_${safeFrom}_${safeTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const maxServiceRevenue = topServices.reduce((max, s) => Math.max(max, Number(s.revenue ?? 0)), 0);

  return (
    <div className="rep-page">
      <Container className="rep-container">
        <header className="rep-header">
          <h1 className="rep-title">Report</h1>
          <p className="rep-subtitle">Analisi andamento e ricavi</p>
        </header>

        {error && <div className="rep-error">{error}</div>}

        <section className="rep-filters">
          <div className="rep-filters-row">
            <div className="rep-filter-group rep-filter-group--dtf">
              <DateTimeField label="Da" mode="date" value={from} onChange={setFrom} placeholder="Da data" className="rep-dtf" />
            </div>
            <div className="rep-filter-group rep-filter-group--dtf">
              <DateTimeField label="A" mode="date" value={to} onChange={setTo} placeholder="A data" className="rep-dtf" />
            </div>
          </div>
          <div className="rep-filter-actions">
            <button className="rep-btn" type="button" onClick={handleManualUpdate} disabled={loading}>
              {loading ? "Aggiornamento…" : "Aggiorna"}
            </button>
            <button type="button" className={`rep-btn-pill${activeShortcut === "M1" ? " rep-btn-pill--active" : ""}`} onClick={() => applyShortcut("M1")}>
              Ultimo mese
            </button>
            <button type="button" className={`rep-btn-pill${activeShortcut === "M3" ? " rep-btn-pill--active" : ""}`} onClick={() => applyShortcut("M3")}>
              Ultimi 3 mesi
            </button>
            <button type="button" className={`rep-btn-pill${activeShortcut === "M6" ? " rep-btn-pill--active" : ""}`} onClick={() => applyShortcut("M6")}>
              Ultimi 6 mesi
            </button>
            <button type="button" className={`rep-btn-pill${activeShortcut === "YEAR" ? " rep-btn-pill--active" : ""}`} onClick={() => applyShortcut("YEAR")}>
              Anno corrente
            </button>
          </div>
        </section>

        {loading && !data && (
          <div className="rep-loading">
            <Spinner animation="border" size="sm" /> Caricamento report…
          </div>
        )}

        {data && (
          <>
            {renderKpi()}

            <section className="rep-card">
              <div className="rep-card-header">
                <div>
                  <div className="rep-card-title">Ricavo mensile</div>
                  <div className="rep-card-sub">Trattamenti e prodotti per mese</div>
                </div>
                <button type="button" className="rep-btn" onClick={exportCsv} disabled={!monthly.length}>
                  📥 Esporta CSV
                </button>
              </div>
              {renderMonthlyChart()}
            </section>

            <section className="rep-sections-grid">
              <div className="rep-card">
                <div className="rep-card-header">
                  <div className="rep-card-title">Servizi più performanti</div>
                </div>
                {topServices.length ? (
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Servizio</th>
                        <th>Prenotazioni</th>
                        <th>Ricavo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topServices.map((s, idx) => {
                        const val = Number(s.revenue ?? 0);
                        const pct = maxServiceRevenue > 0 ? (val / maxServiceRevenue) * 100 : 0;
                        return (
                          <tr key={s.serviceTitle}>
                            <td>{idx + 1}</td>
                            <td>{s.serviceTitle}</td>
                            <td>{s.bookingCount}</td>
                            <td>
                              {fmtCurrency(s.revenue)}
                              <div className="rep-service-bar">
                                <div className="rep-service-bar-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="rep-empty">Nessun servizio completato nel periodo.</div>
                )}
              </div>

              <div className="rep-card">
                <div className="rep-card-header">
                  <div className="rep-card-title">Clienti più frequenti</div>
                </div>
                {topClients.length ? (
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Cliente</th>
                        <th>Prenotazioni</th>
                        <th>Completate</th>
                        <th>Ultima</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topClients.map((c, idx) => (
                        <tr key={`${c.customerName}-${c.customerPhone}-${idx}`}>
                          <td>{idx + 1}</td>
                          <td>
                            {c.customerName}
                            {c.customerPhone && <div className="rep-card-sub">{c.customerPhone}</div>}
                          </td>
                          <td>{c.totalBookings}</td>
                          <td>{c.completedBookings}</td>
                          <td>
                            {c.lastBookingAt
                              ? new Date(c.lastBookingAt).toLocaleString("it-IT", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="rep-empty">Nessun cliente nel periodo selezionato.</div>
                )}
              </div>
            </section>
          </>
        )}
      </Container>
    </div>
  );
}

export default ReportPage;
