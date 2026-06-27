import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { getReport } from "../../api/modules/report.api";
import DateTimeField from "../../components/common/DateTimeField";
import SEO from "../../components/common/SEO";
import { buildWhatsAppUrl } from "../../utils/reminders";

/* ------------------------------------------------------------------ *
 * Static config
 * ------------------------------------------------------------------ */
const TYPES = [
  { key: "trattamenti", label: "Trattamenti", color: "var(--rp-c-trat)" },
  { key: "prodotti", label: "Prodotti", color: "var(--rp-c-prod)" },
  { key: "pacchetti", label: "Pacchetti", color: "var(--rp-c-pac)" },
  { key: "promozioni", label: "Promozioni", color: "var(--rp-c-promo)" },
];
const TYPE_KEYS = TYPES.map(t => t.key);
const ALL_TYPES = { trattamenti: true, prodotti: true, pacchetti: true, promozioni: true };

const CHANNELS = [
  { key: "all", label: "Tutti" },
  { key: "online", label: "Online" },
  { key: "inStore", label: "In negozio" },
];

const PRESETS = [
  { key: "OGGI", label: "Oggi" },
  { key: "SETT", label: "Settimana" },
  { key: "MESE", label: "Mese" },
  { key: "ANNO", label: "Anno" },
  { key: "M1", label: "Ultimo mese" },
  { key: "M3", label: "3 mesi" },
  { key: "M6", label: "6 mesi" },
];

const COMPARE = [
  { key: "prevPeriod", label: "Periodo prec." },
  { key: "prevYear", label: "Anno prec." },
  { key: "none", label: "Nessuno" },
];

const MONTHS_SHORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

/** Weekday labels indexed 0 = Monday … 6 = Sunday (backend weekday is 1 = Mon … 7 = Sun). */
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

/** Light-cream base for the heatmap gold ramp (track colour handles the empty end). */
const HEAT_BASE = "#fcf6ec";

/* ------------------------------------------------------------------ *
 * Formatting helpers (Italian)
 * ------------------------------------------------------------------ */
const num = v => Number(v ?? 0);
const eurFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const intFmt = new Intl.NumberFormat("it-IT");
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" });
const dayMonthFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" });

const eur = v => eurFmt.format(num(v));
const int = v => intFmt.format(num(v));
const pad2 = n => String(n).padStart(2, "0");

/**
 * Editorial gold ramp for the earnings heatmap: cream → gold (--rp-gold) → gold-deep
 * (--rp-gold-deep) over t∈[0,1]. Two color-mix segments keep the mid-tones distinct;
 * t≤0 (empty/no-earn cell) falls back to the faint track colour.
 */
function heatColor(t) {
  if (!(t > 0)) return "var(--rp-track)";
  const c = Math.min(1, t);
  if (c < 0.5) {
    const p = Math.round((c / 0.5) * 100);
    return `color-mix(in srgb, var(--rp-gold) ${p}%, ${HEAT_BASE})`;
  }
  const p = Math.round(((c - 0.5) / 0.5) * 100);
  return `color-mix(in srgb, var(--rp-gold-deep) ${p}%, var(--rp-gold))`;
}

/** Split a formatted euro string into the integer head ("1.234") and the decimal+symbol tail (",56 €"). */
function splitEur(v) {
  const s = eur(v);
  const m = s.match(/^(.+?)([.,]\d{2})(\D*)$/);
  if (!m) return { head: s, tail: "" };
  return { head: m[1], tail: m[2] + (m[3] || "") };
}

/** ISO yyyy-mm-dd from a local Date (no UTC shift). */
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presetRange(key) {
  const today = new Date();
  let from = new Date(today);
  const to = new Date(today);
  switch (key) {
    case "OGGI":
      break;
    case "SETT": {
      const dow = (today.getDay() + 6) % 7; // Monday = 0
      from = new Date(today);
      from.setDate(today.getDate() - dow);
      break;
    }
    case "MESE":
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "ANNO":
      from = new Date(today.getFullYear(), 0, 1);
      break;
    case "M1":
      from = new Date(today);
      from.setMonth(today.getMonth() - 1);
      break;
    case "M3":
      from = new Date(today);
      from.setMonth(today.getMonth() - 3);
      break;
    case "M6":
      from = new Date(today);
      from.setMonth(today.getMonth() - 6);
      break;
    default:
      from = new Date(today.getFullYear(), 0, 1);
  }
  return { from: isoLocal(from), to: isoLocal(to) };
}

function monthsInclusive(fromISO, toISO) {
  if (!fromISO || !toISO) return 1;
  const [fy, fm] = fromISO.split("-").map(Number);
  const [ty, tm] = toISO.split("-").map(Number);
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
}

function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtRange(fromISO, toISO) {
  if (!fromISO || !toISO) return "";
  return `${dateFmt.format(parseISO(fromISO))} – ${dateFmt.format(parseISO(toISO))}`;
}

function monthLabel(m) {
  return `${MONTHS_SHORT[m.month - 1]} ’${String(m.year).slice(-2)}`;
}

/** Italian "day month" (e.g. "29 giu") from a yyyy-mm-dd string. */
const dayMonth = iso => (iso ? dayMonthFmt.format(parseISO(iso)) : "—");

/** Pre-filled WhatsApp dunning message in the owner's voice. */
function waMessage(a) {
  const name = a.clientName ? ` ${String(a.clientName).split(" ")[0]}` : "";
  return `Ciao${name}! Ti scrivo da Beauty Room riguardo a un saldo in sospeso di ${eur(a.amount)}. Quando ti è comodo possiamo sistemarlo. Grazie!`;
}

/* ------------------------------------------------------------------ *
 * Presentational sub-components
 * ------------------------------------------------------------------ */
function DeltaBadge({ delta, pct, size }) {
  const up = delta > 0;
  const down = delta < 0;
  const cls = up ? "is-up" : down ? "is-down" : "is-flat";
  const arrow = up ? "▲" : down ? "▼" : "▬";
  return (
    <span className={`rp-delta ${cls}${size === "sm" ? " rp-delta--sm" : ""}`}>
      <span className="rp-delta-arrow">{arrow}</span>
      {eur(Math.abs(delta))}
      <span className="rp-delta-pct">{Math.abs(pct).toFixed(1)}%</span>
    </span>
  );
}

function TopList({ rows, emptyText, withPhone }) {
  if (!rows?.length) return <div className="rp-top-empty">{emptyText}</div>;
  const max = rows.reduce((mx, r) => Math.max(mx, num(r.revenue)), 0) || 1;
  return (
    <div className="rp-toplist">
      {rows.map((r, idx) => {
        const pct = (num(r.revenue) / max) * 100;
        return (
          <div className="rp-top-row" key={`${r.name}-${r.phone || idx}`}>
            <span className="rp-top-rank">{idx + 1}</span>
            <div className="rp-top-main">
              <span className="rp-top-name">{r.name || "—"}</span>
              {withPhone ? (
                <span className="rp-top-phone">{r.phone || "—"}</span>
              ) : (
                <span className="rp-top-meta">
                  {int(r.count)} {num(r.count) === 1 ? "venduto" : "venduti"}
                </span>
              )}
              {withPhone && (
                <span className="rp-top-meta">
                  {int(r.visits)} {num(r.visits) === 1 ? "visita" : "visite"}
                </span>
              )}
              <div className="rp-top-bar">
                <div className="rp-top-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="rp-top-val">{eur(r.revenue)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Skeletons() {
  return (
    <div className="rp-content" aria-hidden="true">
      <div className="rp-skel rp-skel-hero" />
      <div className="rp-kpis">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="rp-skel rp-skel-kpi" key={i} />
        ))}
      </div>
      <div className="rp-skel rp-skel-chart" />
      <div className="rp-breakdowns">
        <div className="rp-skel rp-skel-card" />
        <div className="rp-skel rp-skel-card" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
function ReportPage() {
  const initial = useMemo(() => presetRange("ANNO"), []);

  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [compareMode, setCompareMode] = useState("prevPeriod");
  const [activePreset, setActivePreset] = useState("ANNO");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Client-side view lenses (no refetch)
  const [channel, setChannel] = useState("all");
  const [types, setTypes] = useState(ALL_TYPES);
  const [activeMonthIdx, setActiveMonthIdx] = useState(null);
  const [tlActive, setTlActive] = useState(null);
  const [inArrivoOpen, setInArrivoOpen] = useState(false); // "In arrivo" detail collapsed by default
  const [heatActive, setHeatActive] = useState(null); // active heatmap cell key (weekday*100 + hour)

  const fetchData = useCallback(async (f, t, c) => {
    setLoading(true);
    setError("");
    try {
      const payload = await getReport(f, t, c);
      setData(payload);
      setActiveMonthIdx(null);
      setHeatActive(null);
    } catch (e) {
      setError(e?.message || "Errore nel caricamento del report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(initial.from, initial.to, "prevPeriod");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = key => {
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
    setActivePreset(key);
    fetchData(r.from, r.to, compareMode);
  };

  const handleManualUpdate = () => {
    setActivePreset(null);
    fetchData(from, to, compareMode);
  };

  const changeCompare = key => {
    setCompareMode(key);
    fetchData(from, to, key);
  };

  /* ---- lens handlers (mutually exclusive: channel locks type) ---- */
  const selectChannel = key => {
    setChannel(key);
    if (key !== "all") setTypes(ALL_TYPES);
  };
  const channelActive = channel !== "all";
  const toggleType = key => {
    if (channelActive) return;
    setTypes(prev => {
      const next = { ...prev, [key]: !prev[key] };
      return TYPE_KEYS.some(k => next[k]) ? next : ALL_TYPES;
    });
  };

  /* ---- derived view model ---- */
  const incassato = data?.incassato;
  const previsto = data?.previsto;
  const comparison = data?.comparison;
  const range = data?.range;

  const selectedKeys = useMemo(() => TYPE_KEYS.filter(k => types[k]), [types]);
  const typeActive = selectedKeys.length > 0 && selectedKeys.length < TYPE_KEYS.length;

  const byType = incassato?.byType;
  const byTypeDelta = comparison?.byTypeDelta;
  const byChannel = incassato?.byChannel;

  const monthly = useMemo(() => {
    const list = incassato?.monthly ? [...incassato.monthly] : [];
    return list.sort((a, b) => a.year - b.year || a.month - b.month);
  }, [incassato]);

  const compareOn = range?.compareMode && range.compareMode !== "none";
  const compareLabel = range?.compareMode === "prevYear" ? "anno precedente" : "periodo precedente";

  // Hero total honours the active lens.
  const heroTotal = useMemo(() => {
    if (!incassato) return 0;
    if (channelActive) return num(byChannel?.[channel]);
    return selectedKeys.reduce((s, k) => s + num(byType?.[k]), 0);
  }, [incassato, channelActive, byChannel, channel, selectedKeys, byType]);

  // Hero comparison: recomputed from byTypeDelta so it stays correct under the
  // type lens. Hidden under the channel lens (no per-channel compare data exists).
  const heroDelta = useMemo(() => {
    if (!compareOn || channelActive || !byTypeDelta || !byType) return null;
    const delta = selectedKeys.reduce((s, k) => s + num(byTypeDelta[k]), 0);
    const compareBase = selectedKeys.reduce((s, k) => s + (num(byType[k]) - num(byTypeDelta[k])), 0);
    const pct = compareBase !== 0 ? (delta / compareBase) * 100 : 0;
    return { delta, pct, compareBase };
  }, [compareOn, channelActive, byTypeDelta, byType, selectedKeys]);

  /* ---- chart geometry ---- */
  const chartKeys = channelActive ? TYPE_KEYS : selectedKeys;
  const monthSel = useCallback(m => chartKeys.reduce((s, k) => s + num(m[k]), 0), [chartKeys]);
  const maxMonth = useMemo(() => monthly.reduce((mx, m) => Math.max(mx, monthSel(m)), 0), [monthly, monthSel]);
  const chartHasData = maxMonth > 0;

  const compareAvg = useMemo(() => {
    if (!compareOn || channelActive || !byType || !byTypeDelta || !range) return 0;
    const base = chartKeys.reduce((s, k) => s + (num(byType[k]) - num(byTypeDelta[k])), 0);
    return base / monthsInclusive(range.compareFrom, range.compareTo);
  }, [compareOn, channelActive, byType, byTypeDelta, range, chartKeys]);

  const effectiveMonthIdx = useMemo(() => {
    if (!monthly.length) return -1;
    if (activeMonthIdx != null && activeMonthIdx < monthly.length) return activeMonthIdx;
    for (let i = monthly.length - 1; i >= 0; i -= 1) if (monthSel(monthly[i]) > 0) return i;
    return monthly.length - 1;
  }, [monthly, activeMonthIdx, monthSel]);

  const heroParts = splitEur(heroTotal);

  /* ---- CSV ---- */
  const exportCsv = () => {
    if (!incassato) return;
    const f2 = v => num(v).toFixed(2).replace(".", ",");
    const lines = ["Mese;Trattamenti (€);Prodotti (€);Pacchetti (€);Promozioni (€);Totale (€)"];
    monthly.forEach(m => {
      lines.push([`${MONTHS_SHORT[m.month - 1]} ${m.year}`, f2(m.trattamenti), f2(m.prodotti), f2(m.pacchetti), f2(m.promozioni), f2(m.totale)].join(";"));
    });
    lines.push("");
    lines.push("Riepilogo;Valore");
    lines.push(`Incassato totale (€);${f2(incassato.total)}`);
    lines.push(`Online (€);${f2(byChannel?.online)}`);
    lines.push(`In negozio (€);${f2(byChannel?.inStore)}`);
    lines.push(`Rimborsi (€);${f2(incassato.refundsTotal)}`);
    lines.push(`Scontrino medio (€);${f2(incassato.averageTicket)}`);
    lines.push(`Appuntamenti;${int(incassato.appointmentsCount)}`);
    lines.push(`Previsto - In arrivo (€);${f2(previsto?.pipelineTotal)}`);
    lines.push(`Previsto - Arretrati (€);${f2(previsto?.arretratiTotal)}`);
    lines.push(`Nuove clienti;${int(data?.newClientsCount)}`);
    lines.push(`Cancellati;${int(data?.cancelledCount)}`);

    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${from}_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ---- donut (by-type) ---- */
  const donutTypes = channelActive ? TYPES : TYPES.filter(t => types[t.key]);
  const donutTotal = donutTypes.reduce((s, t) => s + num(byType?.[t.key]), 0);
  const donutGradient = useMemo(() => {
    if (!byType || donutTotal <= 0) return "var(--rp-track)";
    let acc = 0;
    const stops = donutTypes
      .map(t => {
        const start = (acc / donutTotal) * 100;
        acc += num(byType[t.key]);
        const end = (acc / donutTotal) * 100;
        return `${t.color} ${start}% ${end}%`;
      })
      .join(", ");
    return `conic-gradient(${stops})`;
  }, [byType, donutTypes, donutTotal]);

  const onlineV = num(byChannel?.online);
  const inStoreV = num(byChannel?.inStore);
  const channelTotal = onlineV + inStoreV;

  const hasAnyIncasso = num(incassato?.total) > 0;
  const flagged = num(data?.flaggedSkipped);

  /* ---- previsto detail view-model ---- */
  const prevByType = previsto?.byType;
  const prevByTypeTotal = useMemo(() => TYPE_KEYS.reduce((s, k) => s + num(prevByType?.[k]), 0), [prevByType]);
  // Chips only earn their space with a real split: show them only when ≥2 of the four
  // types carry value (today the pipeline is single-bucket, so they stay hidden).
  const showPrevChips = useMemo(() => TYPE_KEYS.reduce((n, k) => n + (num(prevByType?.[k]) > 0 ? 1 : 0), 0) >= 2, [prevByType]);
  const timeline = useMemo(() => previsto?.timeline ?? [], [previsto]);
  const upcoming = previsto?.upcoming ?? [];
  const arretrati = previsto?.arretrati ?? [];
  const tlMax = useMemo(() => timeline.reduce((mx, w) => Math.max(mx, num(w.amount)), 0), [timeline]);
  const tlActiveIdx = useMemo(() => {
    if (tlActive != null && tlActive < timeline.length) return tlActive;
    return timeline.findIndex(w => num(w.amount) > 0);
  }, [tlActive, timeline]);
  const shownDue = arretrati.reduce((s, a) => s + num(a.amount), 0);
  const dueCapped = arretrati.length >= 15 && num(previsto?.arretratiTotal) - shownDue > 0.005;

  /* ---- timing heatmap view-model ---- */
  const heatmap = useMemo(() => data?.timing?.heatmap ?? [], [data]);
  const heat = useMemo(() => {
    const cells = new Map(); // weekday*100 + hour -> { amount, count }
    const dayTot = [0, 0, 0, 0, 0, 0, 0]; // index 0 = Mon … 6 = Sun
    let minH = 23,
      maxH = 0,
      maxCell = 0;
    heatmap.forEach(c => {
      const wd = Number(c.weekday);
      const hr = Number(c.hour);
      if (!(wd >= 1 && wd <= 7) || !(hr >= 0 && hr <= 23)) return;
      const amount = num(c.amount);
      cells.set(wd * 100 + hr, { amount, count: num(c.count) });
      dayTot[wd - 1] += amount;
      if (hr < minH) minH = hr;
      if (hr > maxH) maxH = hr;
      if (amount > maxCell) maxCell = amount;
    });
    const has = cells.size > 0 && maxH >= minH;
    // Columns clamp to the real hour range — no sea of empty hours.
    const hours = has ? Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i) : [];
    const maxDay = dayTot.reduce((m, v) => Math.max(m, v), 0);
    return { cells, dayTot, hours, maxCell, maxDay, has };
  }, [heatmap]);

  const heatReadout = useMemo(() => {
    if (heatActive == null) return null;
    const cell = heat.cells.get(heatActive);
    if (!cell) return null;
    return { day: WEEKDAYS[Math.floor(heatActive / 100) - 1], hour: heatActive % 100, ...cell };
  }, [heatActive, heat]);

  return (
    <div className="rp-page">
      <SEO title="Report" noindex={true} />

      <div className="rp-shell">
        {/* ---------- Title block (full width, standalone) ---------- */}
        <header className="rp-head">
          <div className="rp-head-titles">
            <span className="section-eyebrow">Report</span>
            <h1 className="section-title rp-h1">Andamento incassi</h1>
            <p className="section-subtitle rp-sub">Quanto hai incassato, da cosa e da chi — in tempo reale.</p>
          </div>
        </header>

        {/* ---------- Unified filters card ---------- */}
        <section className="rp-filters" aria-label="Filtri report">
          <span className="rp-filtri-eyebrow">Filtri</span>
          {/* Periodo — presets + custom range live together (same axis) */}
          <div className="rp-filter-group rp-filter-group--period">
            <span className="rp-lens-cap">Periodo</span>
            <div className="rp-filter-controls">
              <div className="rp-presets">
                {PRESETS.map(p => (
                  <button key={p.key} type="button" className={`rp-preset${activePreset === p.key ? " is-active" : ""}`} onClick={() => applyPreset(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="rp-daterange">
                <DateTimeField label="Da" mode="date" value={from} onChange={setFrom} placeholder="Da" className="rp-dtf" />
                <span className="rp-daterange-sep" aria-hidden="true">
                  →
                </span>
                <DateTimeField label="A" mode="date" value={to} onChange={setTo} placeholder="A" className="rp-dtf" />
                <button type="button" className="rp-apply" onClick={handleManualUpdate} disabled={loading}>
                  {loading ? "…" : "Aggiorna"}
                </button>
              </div>
            </div>
          </div>

          <div className="rp-filter-divider" aria-hidden="true" />

          {/* Confronto */}
          <div className="rp-filter-group">
            <span className="rp-lens-cap">Confronto</span>
            <div className="rp-filter-controls">
              {COMPARE.map(c => (
                <button key={c.key} type="button" className={`rp-seg${compareMode === c.key ? " is-active" : ""}`} onClick={() => changeCompare(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rp-filter-divider" aria-hidden="true" />

          {/* Canale */}
          <div className="rp-filter-group">
            <span className="rp-lens-cap">Canale</span>
            <div className="rp-filter-controls">
              {CHANNELS.map(c => (
                <button key={c.key} type="button" className={`rp-pill${channel === c.key ? " is-active" : ""}`} onClick={() => selectChannel(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rp-filter-divider" aria-hidden="true" />

          {/* Tipo — locked while a channel is selected */}
          <div className="rp-filter-group">
            <span className="rp-lens-cap">Tipo</span>
            <div className="rp-filter-controls">
              {TYPES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  disabled={channelActive}
                  style={{ "--rp-accent": t.color }}
                  className={`rp-pill rp-pill--type${types[t.key] && !channelActive ? " is-active" : ""}${channelActive ? " is-locked" : ""}`}
                  onClick={() => toggleType(t.key)}
                >
                  {t.label}
                </button>
              ))}
              {channelActive && <span className="rp-lens-hint">Filtro per tipo non disponibile per canale</span>}
            </div>
          </div>
        </section>

        {error && <div className="rp-error">{error}</div>}

        {/* ---------- Loading skeletons ---------- */}
        {loading && !data && <Skeletons />}

        {/* ---------- Content ---------- */}
        {data && incassato && (
          <main className="rp-content" style={{ padding: 10 }}>
            {flagged > 0 && (
              <p className="rp-flag">
                ⚠ {int(flagged)} {flagged === 1 ? "voce non valorizzata" : "voci non valorizzate"} — verifica i dati.
              </p>
            )}

            {/* Hero */}
            <section className="rp-hero">
              <div className="rp-hero-main">
                <span className="rp-hero-cap">
                  Incassato{channelActive ? ` · ${CHANNELS.find(c => c.key === channel)?.label}` : typeActive ? " · filtrato" : ""}
                </span>
                {hasAnyIncasso || heroTotal > 0 ? (
                  <div className="rp-hero-num">
                    <span className="rp-hero-int">{heroParts.head}</span>
                    <span className="rp-hero-dec">{heroParts.tail}</span>
                  </div>
                ) : (
                  <div className="rp-hero-num rp-hero-num--empty">Nessun incasso nel periodo</div>
                )}
                <div className="rp-hero-meta">
                  {heroDelta ? (
                    <>
                      <DeltaBadge delta={heroDelta.delta} pct={heroDelta.pct} />
                      <span className="rp-delta-note">vs {compareLabel}</span>
                    </>
                  ) : channelActive && compareOn ? (
                    <span className="rp-delta-note">Confronto non disponibile per canale</span>
                  ) : null}
                </div>
                <span className="rp-hero-range">{fmtRange(range?.from, range?.to)}</span>
              </div>

              <div className="rp-hero-aside">
                <div className="rp-hero-aside-row">
                  <span className="rp-hero-aside-cap">Scontrino medio</span>
                  <span className="rp-hero-aside-val">{eur(incassato.averageTicket)}</span>
                </div>
                <div className="rp-hero-aside-row">
                  <span className="rp-hero-aside-cap">Appuntamenti</span>
                  <span className="rp-hero-aside-val">{int(incassato.appointmentsCount)}</span>
                </div>
                {compareOn && heroDelta && (
                  <div className="rp-hero-aside-row">
                    <span className="rp-hero-aside-cap">{compareLabel}</span>
                    <span className="rp-hero-aside-val">{eur(heroDelta.compareBase)}</span>
                  </div>
                )}
              </div>
            </section>

            {/* KPI row */}
            <section className="rp-kpis">
              {TYPES.map(t => {
                const off = !types[t.key] && !channelActive;
                const d = compareOn && byTypeDelta ? num(byTypeDelta[t.key]) : null;
                const base = d != null ? num(byType[t.key]) - d : 0;
                const pct = base !== 0 ? (d / base) * 100 : 0;
                return (
                  <button
                    key={t.key}
                    type="button"
                    disabled={channelActive}
                    style={{ "--rp-accent": t.color }}
                    className={`rp-kpi rp-kpi--type${off ? " is-off" : ""}${channelActive ? " is-disabled" : ""}`}
                    onClick={() => toggleType(t.key)}
                  >
                    <span className="rp-kpi-accent" />
                    <span className="rp-kpi-cap">{t.label}</span>
                    <span className="rp-kpi-val">{eur(byType?.[t.key])}</span>
                    {d != null && Number.isFinite(pct) && (d !== 0 || base !== 0) ? (
                      <DeltaBadge delta={d} pct={pct} size="sm" />
                    ) : (
                      <span className="rp-kpi-foot">&nbsp;</span>
                    )}
                  </button>
                );
              })}

              <div className="rp-kpi">
                <span className="rp-kpi-cap">Scontrino medio</span>
                <span className="rp-kpi-val">{eur(incassato.averageTicket)}</span>
                <span className="rp-kpi-foot">{int(incassato.appointmentsCount)} appuntamenti</span>
              </div>

              <div className="rp-kpi">
                <span className="rp-kpi-cap">Appuntamenti</span>
                <span className="rp-kpi-val">{int(incassato.appointmentsCount)}</span>
                <span className="rp-kpi-foot">incassati nel periodo</span>
              </div>

              {num(incassato.refundsTotal) > 0 && (
                <div className="rp-kpi rp-kpi--refund">
                  <span className="rp-kpi-cap">Rimborsi</span>
                  <span className="rp-kpi-val">−{eur(incassato.refundsTotal)}</span>
                  <span className="rp-kpi-foot">già dedotti dal totale</span>
                </div>
              )}
            </section>

            {/* Previsto */}
            <section className="rp-previsto">
              <div className="rp-previsto-head">
                <span className="rp-previsto-eyebrow">Previsto · non incassato</span>
                <p className="rp-previsto-desc">Valore prenotato o dovuto, non ancora entrato in cassa.</p>
              </div>

              <div className="rp-previsto-grid">
                {/* ---- In arrivo (compact summary; detail behind a toggle) ---- */}
                <div className="rp-prev-col">
                  <div className="rp-prev-headline">
                    <span className="rp-prev-cap">In arrivo</span>
                    <span className="rp-prev-val">{eur(previsto?.pipelineTotal)}</span>
                    <span className="rp-prev-sub">{int(previsto?.upcomingCount)} appuntamenti futuri</span>
                    <button
                      type="button"
                      className="rp-prev-toggle"
                      aria-expanded={inArrivoOpen}
                      aria-controls="rp-inarrivo-detail"
                      onClick={() => setInArrivoOpen(o => !o)}
                    >
                      {inArrivoOpen ? "Nascondi dettagli ▴" : "Guarda dettagli ▾"}
                    </button>
                  </div>

                  <div className={`rp-prev-detail${inArrivoOpen ? " is-open" : ""}`} id="rp-inarrivo-detail">
                    <div className="rp-prev-detail-inner" inert={!inArrivoOpen}>
                      {showPrevChips && (
                        <div className="rp-prev-bytype">
                          {TYPES.map(t => {
                            const v = num(prevByType?.[t.key]);
                            const pct = prevByTypeTotal > 0 ? (v / prevByTypeTotal) * 100 : 0;
                            return (
                              <div className="rp-prev-chip" key={t.key}>
                                <span className="rp-prev-chip-head">
                                  <span className="rp-dot" style={{ background: t.color }} />
                                  <span className="rp-prev-chip-name">{t.label}</span>
                                  <span className="rp-prev-chip-val">{eur(v)}</span>
                                </span>
                                <span className="rp-prev-chip-track">
                                  <span className="rp-prev-chip-fill" style={{ width: `${pct}%`, background: t.color }} />
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="rp-prev-tl">
                        <div className="rp-prev-tl-head">
                          <span className="rp-prev-mini-cap">Prossime 8 settimane</span>
                          {tlActiveIdx >= 0 && timeline[tlActiveIdx] && (
                            <span className="rp-prev-tl-readout">
                              {dayMonth(timeline[tlActiveIdx].weekStart)} · {eur(timeline[tlActiveIdx].amount)} · {int(timeline[tlActiveIdx].count)} app.
                            </span>
                          )}
                        </div>
                        {timeline.length ? (
                          <div className="rp-prev-tl-bars">
                            {timeline.map((w, idx) => {
                              const h = tlMax > 0 ? (num(w.amount) / tlMax) * 100 : 0;
                              const empty = num(w.amount) <= 0;
                              return (
                                <div
                                  key={w.weekStart}
                                  className={`rp-prev-tl-col${idx === tlActiveIdx ? " is-active" : ""}${empty ? " is-empty" : ""}`}
                                  onMouseEnter={() => setTlActive(idx)}
                                  onFocus={() => setTlActive(idx)}
                                  onClick={() => setTlActive(idx)}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`${dayMonth(w.weekStart)}: ${eur(w.amount)}, ${int(w.count)} appuntamenti`}
                                  title={`${dayMonth(w.weekStart)} · ${eur(w.amount)} · ${int(w.count)} app.`}
                                >
                                  <span className="rp-prev-tl-track">
                                    <span className="rp-prev-tl-fill" style={{ height: `${Math.max(h, empty ? 0 : 4)}%` }} />
                                  </span>
                                  <span className="rp-prev-tl-label">{dayMonth(w.weekStart)}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rp-prev-empty">Nessun appuntamento in arrivo.</div>
                        )}
                      </div>

                      <div className="rp-prev-upcoming">
                        <span className="rp-prev-mini-cap">Prossimi appuntamenti</span>
                        {upcoming.length ? (
                          <ul className="rp-prev-up-list">
                            {upcoming.map((u, idx) => (
                              <li className="rp-prev-up-row" key={`${u.date}-${idx}`}>
                                <span className="rp-prev-up-date">{dayMonth(u.date)}</span>
                                <span className="rp-prev-up-client">{u.clientName || "—"}</span>
                                <span className="rp-prev-up-svc">{u.serviceName || "—"}</span>
                                <span className="rp-prev-up-amt">{eur(u.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="rp-prev-empty">Nessun appuntamento in arrivo.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---- Arretrati ---- */}
                <div className="rp-prev-col rp-prev-col--due">
                  <div className="rp-prev-headline">
                    <span className="rp-prev-cap rp-prev-cap--due">Arretrati · da incassare</span>
                    <span className="rp-prev-val rp-prev-val--due">{eur(previsto?.arretratiTotal)}</span>
                    <span className="rp-prev-sub">
                      {arretrati.length
                        ? `${int(arretrati.length)} ${arretrati.length === 1 ? "cliente da contattare" : "clienti da contattare"}`
                        : "tutto saldato"}
                    </span>
                  </div>

                  {arretrati.length ? (
                    <>
                      <ul className="rp-prev-due-list">
                        {arretrati.map((a, idx) => (
                          <li className="rp-prev-due-row" key={`${a.phone || a.clientName}-${idx}`}>
                            <div className="rp-prev-due-info">
                              <span className="rp-prev-due-name">{a.clientName || "—"}</span>
                              <span className="rp-prev-due-since">da {a.since ? dayMonth(a.since) : "—"}</span>
                            </div>
                            <span className="rp-prev-due-amt">{eur(a.amount)}</span>
                            {a.phone ? (
                              <a
                                className="rp-prev-wa"
                                href={buildWhatsAppUrl(a.phone, waMessage(a))}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Scrivi a ${a.clientName || "cliente"} su WhatsApp`}
                              >
                                WhatsApp
                              </a>
                            ) : (
                              <span className="rp-prev-wa is-off" aria-hidden="true">
                                —
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {dueCapped && <div className="rp-prev-due-more">Mostrati i 15 maggiori · totale {eur(previsto?.arretratiTotal)}</div>}
                    </>
                  ) : (
                    <div className="rp-prev-empty rp-prev-empty--ok">Nessun arretrato — sei in pari.</div>
                  )}
                </div>
              </div>
            </section>

            {/* Monthly chart */}
            <section className="rp-card rp-chart-card">
              <div className="rp-card-head">
                <div>
                  <span className="rp-card-eyebrow">Andamento mensile</span>
                  <h2 className="rp-card-title">Incassato per mese</h2>
                  {channelActive && <span className="rp-card-sub">Dettaglio per tipo · tutti i canali</span>}
                </div>
                <button type="button" className="rp-csv" onClick={exportCsv} disabled={!monthly.length}>
                  ↓ Esporta CSV
                </button>
              </div>

              {chartHasData ? (
                <div className="rp-chart-grid">
                  <div className="rp-plot">
                    <div className="rp-bars">
                      {compareOn && compareAvg > 0 && (
                        <div className="rp-cmpline" style={{ bottom: `${Math.min(100, (compareAvg / maxMonth) * 100)}%` }}>
                          <span className="rp-cmpline-label">media {compareLabel}</span>
                        </div>
                      )}
                      {monthly.map((m, idx) => {
                        const sel = monthSel(m);
                        const active = idx === effectiveMonthIdx;
                        return (
                          <div
                            key={`${m.year}-${m.month}`}
                            className={`rp-col${active ? " is-active" : ""}`}
                            onMouseEnter={() => setActiveMonthIdx(idx)}
                            onFocus={() => setActiveMonthIdx(idx)}
                            onClick={() => setActiveMonthIdx(idx)}
                            role="button"
                            tabIndex={0}
                            aria-label={`${monthLabel(m)}: ${eur(sel)}`}
                          >
                            <div className="rp-col-track">
                              {sel === 0 ? (
                                <div className="rp-col-zero" />
                              ) : (
                                chartKeys.map(k => {
                                  const v = num(m[k]);
                                  if (v <= 0) return null;
                                  const t = TYPES.find(x => x.key === k);
                                  return <div key={k} className="rp-seg2" style={{ height: `${(v / maxMonth) * 100}%`, background: t.color }} />;
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="rp-labels">
                      {monthly.map(m => (
                        <span key={`${m.year}-${m.month}`} className={`rp-col-label${monthly[effectiveMonthIdx] === m ? " is-active" : ""}`}>
                          {MONTHS_SHORT[m.month - 1]}
                        </span>
                      ))}
                    </div>
                  </div>

                  <aside className="rp-readout">
                    {effectiveMonthIdx >= 0 && monthly[effectiveMonthIdx] && (
                      <>
                        <span className="rp-readout-month">{monthLabel(monthly[effectiveMonthIdx])}</span>
                        <div className="rp-readout-rows">
                          {(channelActive ? TYPES : TYPES.filter(t => types[t.key])).map(t => (
                            <div className="rp-readout-row" key={t.key}>
                              <span className="rp-swatch" style={{ background: t.color }} />
                              <span className="rp-readout-name">{t.label}</span>
                              <span className="rp-readout-amt">{eur(monthly[effectiveMonthIdx][t.key])}</span>
                            </div>
                          ))}
                        </div>
                        <div className="rp-readout-tot">
                          <span>Totale</span>
                          <span>{eur(monthSel(monthly[effectiveMonthIdx]))}</span>
                        </div>
                      </>
                    )}
                  </aside>
                </div>
              ) : (
                <div className="rp-chart-empty">Nessun incasso nel periodo selezionato.</div>
              )}

              <div className="rp-legend">
                {TYPES.map(t => (
                  <span key={t.key} className={`rp-legend-item${!channelActive && !types[t.key] ? " is-dim" : ""}`}>
                    <span className="rp-dot" style={{ background: t.color }} />
                    {t.label}
                  </span>
                ))}
              </div>
            </section>

            {/* Breakdowns */}
            <section className="rp-breakdowns">
              <div className="rp-card rp-channel-card">
                <div className="rp-card-head">
                  <div>
                    <span className="rp-card-eyebrow">Canali</span>
                    <h2 className="rp-card-title">Online vs in negozio</h2>
                  </div>
                </div>
                {channelTotal > 0 ? (
                  <>
                    <div className="rp-channel-bar">
                      <div
                        className={`rp-channel-seg${channelActive && channel !== "online" ? " is-dim" : ""}`}
                        style={{ width: `${(onlineV / channelTotal) * 100}%`, background: "var(--rp-online)" }}
                      />
                      <div
                        className={`rp-channel-seg${channelActive && channel !== "inStore" ? " is-dim" : ""}`}
                        style={{ width: `${(inStoreV / channelTotal) * 100}%`, background: "var(--rp-instore)" }}
                      />
                    </div>
                    <div className="rp-channel-legend">
                      <div className="rp-channel-item">
                        <span className="rp-dot" style={{ background: "var(--rp-online)" }} />
                        <span className="rp-channel-name">Online</span>
                        <span className="rp-channel-val">{eur(onlineV)}</span>
                        <span className="rp-channel-pct">{((onlineV / channelTotal) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="rp-channel-item">
                        <span className="rp-dot" style={{ background: "var(--rp-instore)" }} />
                        <span className="rp-channel-name">In negozio</span>
                        <span className="rp-channel-val">{eur(inStoreV)}</span>
                        <span className="rp-channel-pct">{((inStoreV / channelTotal) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rp-top-empty">Nessun incasso nel periodo.</div>
                )}
              </div>

              <div className="rp-card rp-donut-card">
                <div className="rp-card-head">
                  <div>
                    <span className="rp-card-eyebrow">Composizione</span>
                    <h2 className="rp-card-title">Per tipologia</h2>
                  </div>
                </div>
                <div className="rp-donut-wrap">
                  <div className="rp-donut" style={{ background: donutGradient }}>
                    <div className="rp-donut-hole">
                      <span className="rp-donut-hole-cap">Totale</span>
                      <span className="rp-donut-hole-val">{eur(donutTotal)}</span>
                    </div>
                  </div>
                  <div className="rp-donut-legend">
                    {donutTypes.map(t => {
                      const v = num(byType?.[t.key]);
                      const pct = donutTotal > 0 ? (v / donutTotal) * 100 : 0;
                      return (
                        <div className="rp-donut-item" key={t.key}>
                          <span className="rp-dot" style={{ background: t.color }} />
                          <span className="rp-donut-name">{t.label}</span>
                          <span className="rp-donut-val">{eur(v)}</span>
                          <span className="rp-donut-pct">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Quando incassi di più — weekday x hour earnings heatmap (trattamenti leg) */}
            <section className="rp-card rp-heat-card">
              <div className="rp-card-head">
                <div>
                  <span className="rp-card-eyebrow">Mappa settimanale</span>
                  <h2 className="rp-card-title">Quando incassi di più</h2>
                  <span className="rp-card-sub">Incasso trattamenti per giorno e ora.</span>
                </div>
                {heatReadout && (
                  <div className="rp-heat-readout">
                    <span className="rp-heat-readout-when">
                      {heatReadout.day} {pad2(heatReadout.hour)}:00
                    </span>
                    <span className="rp-heat-readout-amt">{eur(heatReadout.amount)}</span>
                    <span className="rp-heat-readout-cnt">
                      {int(heatReadout.count)} {heatReadout.count === 1 ? "appuntamento" : "appuntamenti"}
                    </span>
                  </div>
                )}
              </div>

              {heat.has ? (
                <>
                  <div className="rp-heat-scroll" data-lenis-prevent>
                    <div className="rp-heat-grid" style={{ gridTemplateColumns: `var(--rp-heat-daycol) repeat(${heat.hours.length}, minmax(34px, 1fr))` }}>
                      <span className="rp-heat-corner" aria-hidden="true" />
                      {heat.hours.map(h => (
                        <span className="rp-heat-hhead" key={`h-${h}`}>
                          {h}
                        </span>
                      ))}
                      {WEEKDAYS.map((label, di) => {
                        const wd = di + 1;
                        return (
                          <Fragment key={`row-${wd}`}>
                            <span className="rp-heat-dhead">{label}</span>
                            {heat.hours.map(h => {
                              const key = wd * 100 + h;
                              const cell = heat.cells.get(key);
                              if (!cell) {
                                return <span className="rp-heat-cell is-empty" key={key} aria-hidden="true" />;
                              }
                              const t = heat.maxCell > 0 ? cell.amount / heat.maxCell : 0;
                              return (
                                <button
                                  type="button"
                                  key={key}
                                  className={`rp-heat-cell${key === heatActive ? " is-active" : ""}`}
                                  style={{ background: heatColor(t) }}
                                  onMouseEnter={() => setHeatActive(key)}
                                  onFocus={() => setHeatActive(key)}
                                  onClick={() => setHeatActive(key)}
                                  aria-label={`${label} ${pad2(h)}:00 · ${eur(cell.amount)} · ${int(cell.count)} appuntamenti`}
                                  title={`${label} ${pad2(h)}:00 · ${eur(cell.amount)}`}
                                />
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rp-heat-days">
                    {WEEKDAYS.map((label, di) => {
                      const v = heat.dayTot[di];
                      const w = heat.maxDay > 0 ? (v / heat.maxDay) * 100 : 0;
                      return (
                        <div className={`rp-heat-day${v > 0 ? "" : " is-empty"}`} key={`d-${di}`}>
                          <span className="rp-heat-day-label">{label}</span>
                          <span className="rp-heat-day-track">
                            <span className="rp-heat-day-fill" style={{ width: `${w}%` }} />
                          </span>
                          <span className="rp-heat-day-val">{eur(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="rp-heat-empty">Dati insufficienti per la mappa.</div>
              )}
            </section>

            {/* Top tables */}
            <section className="rp-tables">
              <div className="rp-card">
                <div className="rp-card-head">
                  <div>
                    <span className="rp-card-eyebrow">Classifica</span>
                    <h2 className="rp-card-title">Top servizi</h2>
                  </div>
                </div>
                <TopList rows={data.topServices} emptyText="Nessun servizio incassato nel periodo." />
              </div>

              <div className="rp-card">
                <div className="rp-card-head">
                  <div>
                    <span className="rp-card-eyebrow">Classifica</span>
                    <h2 className="rp-card-title">Top prodotti</h2>
                  </div>
                </div>
                <TopList rows={data.topProducts} emptyText="Nessun prodotto venduto nel periodo." />
              </div>

              <div className="rp-card">
                <div className="rp-card-head">
                  <div>
                    <span className="rp-card-eyebrow">Classifica</span>
                    <h2 className="rp-card-title">Top clienti</h2>
                  </div>
                </div>
                <TopList rows={data.topClients} emptyText="Nessun cliente nel periodo." withPhone />
              </div>
            </section>

            <footer className="rp-foot">
              <span>{int(data.newClientsCount)} nuove clienti</span>
              <span className="rp-foot-dot">·</span>
              <span>{int(data.cancelledCount)} cancellati</span>
              {fmtRange(range?.compareFrom, range?.compareTo) && compareOn && (
                <>
                  <span className="rp-foot-dot">·</span>
                  <span>confronto: {fmtRange(range.compareFrom, range.compareTo)}</span>
                </>
              )}
            </footer>
          </main>
        )}
      </div>
    </div>
  );
}

export default ReportPage;
