import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DurationField from "../common/DurationField";
import { createPackageAssignment, createRecurringTemplate, fetchCatalogPackages, fetchRecurringTemplates, updatePackageAssignment } from "../../api/modules/adminAgenda.api";
import "./PackageForm.css";

// ── Helpers ───────────────────────────────────────────────────────────────────
const newServiceRow = (patch = {}) => ({
  uid: crypto.randomUUID(),
  kind: "service",
  serviceId: "",
  serviceOptionId: null,
  customName: "",
  ...patch,
});

const newCustomRow = (patch = {}) => ({
  uid: crypto.randomUUID(),
  kind: "custom",
  serviceId: null,
  serviceOptionId: null,
  customName: "",
  ...patch,
});

const round2 = n => Math.round(n * 100) / 100;
const DISCOUNT_CHIPS = [0.05, 0.1, 0.15, 0.2];

// Stable key for picker selection lookup. Plain service → "<id>::"; with option → "<id>::<optionId>".
const serviceKey = (serviceId, optionId) => `${serviceId}::${optionId ?? ""}`;

// V64 M1: signature of the editable fields a template seeds. The "modello" hint
// shows only while the current form still matches the seed (hides on first edit).
const seedSignature = (name, composition, pricePaid, sessionDurationMin) =>
  JSON.stringify({
    n: name,
    p: pricePaid,
    d: sessionDurationMin,
    c: composition.map(r => [r.kind, r.serviceId, r.serviceOptionId, r.customName]),
  });

// ── ServicePicker ─────────────────────────────────────────────────────────────
// Full catalog list mirroring AppointmentForm's .ag-service-list pattern.
// Multi-select via toggle: clicking a row that is already in `selectedKeys`
// removes it; otherwise it is added (parent decides via onPick).
function ServicePicker({ services, selectedKeys, onPick }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const categories = useMemo(() => {
    const seen = new Set();
    return (services || []).reduce((acc, s) => {
      const cat = s.category ?? s.categoryName ?? s.categoryLabel ?? null;
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        acc.push(cat);
      }
      return acc;
    }, []);
  }, [services]);

  const filtered = useMemo(() => {
    let list = services || [];
    if (catFilter !== "all") {
      list = list.filter(s => (s.category ?? s.categoryName ?? s.categoryLabel) === catFilter);
    }
    const needle = search.trim().toLowerCase();
    if (needle) {
      list = list.filter(s => {
        if (s.title?.toLowerCase().includes(needle)) return true;
        const opts = s.options || s.serviceOptionList || s.serviceOptions || [];
        return opts.some(o => o.name?.toLowerCase().includes(needle));
      });
    }
    return list;
  }, [services, catFilter, search]);

  return (
    <div className="pkgf-picker">
      <input
        type="text"
        className="ag-service-search"
        placeholder="Cerca servizio…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {categories.length > 0 && (
        <div className="ag-service-cats">
          <button type="button" className={`ag-service-cat${catFilter === "all" ? " is-active" : ""}`} onClick={() => setCatFilter("all")}>
            Tutti
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`ag-service-cat${catFilter === cat ? " is-active" : ""}`}
              onClick={() => setCatFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      <div className="ag-service-list">
        {filtered.length === 0 && <div className="ag-service-empty">Nessun servizio trovato.</div>}
        {filtered.map(s => {
          const opts = (s.options || s.serviceOptionList || s.serviceOptions || []).filter(o => o.active !== false && (o.sessions ?? 1) <= 1);
          const hasOpts = opts.length > 0;
          const isExpanded = expandedId === s.serviceId;
          if (hasOpts) {
            return (
              <div key={s.serviceId} className={`ag-service-item-wrapper${isExpanded ? " is-expanded" : ""}`}>
                <button
                  type="button"
                  className="ag-service-item ag-service-item--has-options"
                  onClick={() => setExpandedId(isExpanded ? null : s.serviceId)}
                >
                  <span className="ag-service-item__title">{s.title}</span>
                  <span className="ag-service-item__meta">
                    <span className="ag-service-expand-icon">{isExpanded ? "▾" : "▸"}</span>
                  </span>
                </button>
                {isExpanded && (
                  <div className="ag-service-options">
                    {opts.map(opt => {
                      const optId = opt.optionId ?? opt.id;
                      const isSelected = selectedKeys.has(serviceKey(s.serviceId, optId));
                      return (
                        <button
                          key={optId}
                          type="button"
                          className={`ag-service-option-item${isSelected ? " ag-service-option-item--selected" : ""}`}
                          onClick={() => onPick(s, opt)}
                        >
                          <span className="ag-service-option-item__name">{opt.name}</span>
                          <span className="ag-service-item__meta">
                            {opt.price != null ? `€${Number(opt.price).toFixed(0)}` : ""}
                            {isSelected && <span className="ag-option-check"> ✓</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const isSelected = selectedKeys.has(serviceKey(s.serviceId, null));
          return (
            <button
              key={s.serviceId}
              type="button"
              className={`ag-service-item${isSelected ? " ag-service-item--selected" : ""}`}
              onClick={() => onPick(s, null)}
            >
              <span className="ag-service-item__title">{s.title}</span>
              <span className="ag-service-item__meta">
                {s.price != null ? `€${Number(s.price).toFixed(0)}` : ""}
                {isSelected && <span className="ag-service-item__selected-count"> ✓</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── PackageForm ───────────────────────────────────────────────────────────────
export default function PackageForm({ customer, services = [], editingPackage = null, onSaved }) {
  const isEdit = editingPackage != null;

  // Original completed sessions — frozen for this edit session
  const completedOriginal = useMemo(
    () => (isEdit ? Math.max(0, (editingPackage.totalSessions ?? 0) - (editingPackage.sessionsRemaining ?? 0)) : 0),
    [isEdit, editingPackage],
  );

  // ── State ───────────────────────────────────────────────────────────────────
  // Two modes only: "catalog" | "service". Edit always renders the "service" UI.
  const [mode, setMode] = useState(isEdit ? "service" : "catalog");
  const [name, setName] = useState("");
  const [composition, setComposition] = useState([]);
  const [totalSessions, setTotalSessions] = useState("1");
  const [startSession, setStartSession] = useState("1");
  const [sessionDurationMin, setSessionDurationMin] = useState(null);
  const [pricePaid, setPricePaid] = useState("");
  const [paidUpfront, setPaidUpfront] = useState(false);
  const [notes, setNotes] = useState("");

  const [catalogPackages, setCatalogPackages] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState("");

  // V64 M1: recurring package templates (reusable admin-only recipes).
  const [recurringTemplates, setRecurringTemplates] = useState([]);
  const [saveAsRecurring, setSaveAsRecurring] = useState(false);
  // Snapshot of the seed applied by handleRecurringPick; the "modello" hint shows
  // only while name/composition/price/duration still match it (hides on first edit).
  const seedSigRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  // ── Catalog packages fetch (once) ───────────────────────────────────────────
  useEffect(() => {
    fetchCatalogPackages()
      .then(opts => setCatalogPackages(opts || []))
      .catch(() => setCatalogPackages([]));
  }, []);

  // ── Recurring templates fetch (once) ────────────────────────────────────────
  useEffect(() => {
    fetchRecurringTemplates()
      .then(t => setRecurringTemplates(t || []))
      .catch(() => setRecurringTemplates([]));
  }, []);

  // ── Prefill from editingPackage (or reset to defaults) ──────────────────────
  useEffect(() => {
    if (isEdit) {
      setMode("service");
      // Use customPackageName as-is; if absent the user can leave the field empty
      // and the derived-name logic provides a sensible default on save.
      setName(editingPackage.customPackageName ?? "");
      const items = Array.isArray(editingPackage.items) ? [...editingPackage.items].sort((a, b) => a.position - b.position) : [];
      setComposition(
        items.length > 0
          ? items.map(it => {
              if (it.serviceId || it.serviceOptionId) {
                const fullTitle = it.serviceOptionName
                  ? `${it.serviceTitle ?? ""}${it.serviceTitle && it.serviceOptionName ? " · " : ""}${it.serviceOptionName ?? ""}`.trim()
                  : (it.serviceTitle ?? "");
                return newServiceRow({
                  serviceId: it.serviceId ?? "",
                  serviceOptionId: it.serviceOptionId ?? null,
                  customName: fullTitle,
                });
              }
              return newCustomRow({ customName: it.customName ?? "" });
            })
          : [],
      );
      setTotalSessions(String(editingPackage.totalSessions ?? 1));
      setStartSession(String(editingPackage.startSession ?? 1));
      setSessionDurationMin(editingPackage.sessionDurationMin ?? null);
      setPricePaid(editingPackage.pricePaid != null ? String(editingPackage.pricePaid) : "");
      setPaidUpfront(!!editingPackage.paidUpfront);
      setNotes(editingPackage.notes ?? "");
    } else {
      setMode("catalog");
      setName("");
      setComposition([]);
      setTotalSessions("1");
      setStartSession("1");
      setSessionDurationMin(null);
      setPricePaid("");
      setPaidUpfront(false);
      setNotes("");
    }
    setCatalogSearch("");
    setSubmitted(false);
    setErrors({});
    setSubmitError("");
    setSaveAsRecurring(false);
    seedSigRef.current = null; // not seeded from a template
  }, [editingPackage, isEdit]);

  // Mode switch (create only) resets composition + derived defaults
  const switchMode = useCallback(next => {
    setMode(next);
    setName("");
    setComposition([]);
    setTotalSessions("1");
    setStartSession("1");
    setSessionDurationMin(null);
    setPricePaid("");
    setCatalogSearch("");
    setSaveAsRecurring(false);
    seedSigRef.current = null;
  }, []);

  // ── Catalog mode pick (single-pick prefill, unchanged from Phase 4) ────────
  // Pick a visible name even when the catalog row's optionName is null —
  // otherwise the input stays empty and submit drops customPackageName, which
  // the backend renders as "Pacchetto senza nome".
  const handleCatalogPick = useCallback(
    opt => {
      const svc = services.find(s => String(s.serviceId) === String(opt.serviceId));
      let optDuration = null;
      if (svc) {
        const allOpts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
        const match = allOpts.find(o => String(o.optionId ?? o.id) === String(opt.optionId));
        optDuration = match?.durationMin ?? null;
      }
      const pickedName = opt.optionName ?? opt.serviceName ?? opt.name ?? svc?.title ?? "";
      setName(pickedName);
      setComposition([
        newServiceRow({
          serviceId: opt.serviceId,
          serviceOptionId: opt.optionId,
          customName: pickedName,
        }),
      ]);
      setTotalSessions(opt.sessions != null ? String(opt.sessions) : "1");
      setStartSession("1");
      setSessionDurationMin(optDuration);
      setPricePaid(opt.price != null ? String(opt.price) : "");
    },
    [services],
  );

  // ── Recurring template pick: seed the manual "service" form, fully editable ──
  // Sessions are NOT stored on a template (schema has no field) → totalSessions is
  // left untouched and set by the admin. SET-NULL items (service hard-deleted)
  // degrade to a custom row showing customName or "Servizio rimosso".
  const handleRecurringPick = useCallback(t => {
    const nextName = t.name ?? "";
    const nextComposition = (Array.isArray(t.items) ? [...t.items].sort((a, b) => a.position - b.position) : []).map(it => {
      if (it.serviceId || it.serviceOptionId) {
        const fullTitle = it.serviceOptionName
          ? `${it.serviceTitle ?? ""}${it.serviceTitle && it.serviceOptionName ? " · " : ""}${it.serviceOptionName ?? ""}`.trim()
          : (it.serviceTitle ?? it.customName ?? "");
        return newServiceRow({
          serviceId: it.serviceId ?? "",
          serviceOptionId: it.serviceOptionId ?? null,
          customName: fullTitle,
        });
      }
      return newCustomRow({ customName: it.customName ?? "Servizio rimosso" });
    });
    const nextDuration = t.defaultDurationMin ?? null;
    const nextPrice = t.defaultPrice != null ? String(t.defaultPrice) : "";

    setName(nextName);
    setComposition(nextComposition);
    setSessionDurationMin(nextDuration);
    setPricePaid(nextPrice);
    seedSigRef.current = seedSignature(nextName, nextComposition, nextPrice, nextDuration);
    setMode("service");
  }, []);

  // ── Service mode: toggle catalog row in composition ────────────────────────
  const toggleServiceRow = useCallback((svc, opt) => {
    const optId = opt ? (opt.optionId ?? opt.id) : null;
    setComposition(prev => {
      const idx = prev.findIndex(
        r => r.kind === "service" && String(r.serviceId) === String(svc.serviceId) && String(r.serviceOptionId ?? "") === String(optId ?? ""),
      );
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [
        ...prev,
        newServiceRow({
          serviceId: svc.serviceId,
          serviceOptionId: optId,
          customName: opt ? `${svc.title} · ${opt.name}` : svc.title,
        }),
      ];
    });
  }, []);

  const addEmptyCustomRow = useCallback(() => {
    setComposition(prev => [...prev, newCustomRow({ customName: "" })]);
  }, []);

  const removeRow = useCallback(uid => setComposition(prev => prev.filter(r => r.uid !== uid)), []);
  const updateCustomRow = useCallback((uid, customName) => {
    setComposition(prev => prev.map(r => (r.uid === uid ? { ...r, customName } : r)));
  }, []);

  // ── Derived: selected keys for picker highlight ────────────────────────────
  const selectedServiceKeys = useMemo(() => {
    const set = new Set();
    composition.forEach(r => {
      if (r.kind === "service") set.add(serviceKey(r.serviceId, r.serviceOptionId));
    });
    return set;
  }, [composition]);

  // ── Derived: auto-name when exactly one row and name empty ─────────────────
  // For a single-row composition the system can name the package after that row.
  // For 2+ rows there is no sensible auto-name — the user must provide one
  // (enforced by validation below).
  const derivedName = useMemo(() => {
    if (composition.length !== 1) return null;
    const row = composition[0];
    if (row.kind === "custom") return row.customName?.trim() || null;
    if (row.customName) return row.customName;
    const svc = services.find(s => String(s.serviceId) === String(row.serviceId));
    if (!svc) return null;
    if (row.serviceOptionId != null) {
      const opts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
      const opt = opts.find(o => String(o.optionId ?? o.id) === String(row.serviceOptionId));
      return opt ? `${svc.title} · ${opt.name}` : svc.title;
    }
    return svc.title;
  }, [composition, services]);

  // V64 M1: the "modello — modifica liberamente" hint shows only while the form
  // still matches the seeded template snapshot (hides on the first manual edit).
  const currentSig = useMemo(
    () => seedSignature(name, composition, pricePaid, sessionDurationMin),
    [name, composition, pricePaid, sessionDurationMin],
  );
  const showTemplateHint = seedSigRef.current != null && seedSigRef.current === currentSig;

  // ── Price calc ──────────────────────────────────────────────────────────────
  // fullPriceData.total is the FULL package list price (sum of composition rows
  // × number of sessions). Pre-V62 fix this was just the per-session sum, which
  // caused the -5%/-10% chips to discount one session instead of the package.
  const fullPriceData = useMemo(() => {
    const serviceRows = composition.filter(r => r.kind === "service");
    if (serviceRows.length === 0) return null;
    let sumPerSession = 0;
    let allKnown = true;
    for (const row of serviceRows) {
      const svc = services.find(s => String(s.serviceId) === String(row.serviceId));
      if (!svc) {
        allKnown = false;
        continue;
      }
      let p = null;
      if (row.serviceOptionId != null) {
        const allOpts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
        const opt = allOpts.find(o => String(o.optionId ?? o.id) === String(row.serviceOptionId));
        p = opt?.price ?? svc.price ?? null;
      } else {
        p = svc.price ?? null;
      }
      if (p == null) allKnown = false;
      else sumPerSession += Number(p);
    }
    if (!allKnown || sumPerSession <= 0) return null;
    const sessions = Math.max(1, Number(totalSessions) || 1);
    const total = sumPerSession * sessions;
    return { total, perSession: sumPerSession };
  }, [composition, services, totalSessions]);

  const priceCalc = useMemo(() => {
    const sessions = parseInt(totalSessions, 10);
    const paid = parseFloat(pricePaid);
    if (!sessions || sessions < 1 || isNaN(paid) || paid <= 0) return null;
    const perSession = paid / sessions;
    const savings = fullPriceData != null && fullPriceData.total > paid ? fullPriceData.total - paid : null;
    const discountPct = savings != null && fullPriceData != null ? (savings / fullPriceData.total) * 100 : null;
    return { perSession, savings, discountPct };
  }, [pricePaid, totalSessions, fullPriceData]);

  const applyDiscount = useCallback(
    pct => {
      if (!fullPriceData) return;
      setPricePaid(String(round2(fullPriceData.total * (1 - pct))));
    },
    [fullPriceData],
  );

  const totalNum = parseInt(totalSessions, 10) || 0;
  const startNum = parseInt(startSession, 10) || 0;
  const doneFromStart = Math.max(0, startNum - 1);
  const remaining = Math.max(0, totalNum - doneFromStart);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    if (!customer?.fullName?.trim()) errs.customer = "Seleziona una cliente prima di creare un pacchetto.";
    if (composition.length === 0) errs.composition = "Aggiungi almeno un servizio o una riga personalizzata.";
    composition.forEach(r => {
      if (r.kind === "service" && !r.serviceId) errs[r.uid] = "Servizio mancante";
      if (r.kind === "custom" && !r.customName.trim()) errs[r.uid] = "Nome obbligatorio";
    });
    // Multi-row packages cannot be auto-named: require an explicit name
    if (composition.length > 1 && !name.trim()) {
      errs.name = "Dai un nome al pacchetto quando contiene più trattamenti.";
    }
    const tn = parseInt(totalSessions, 10);
    if (!tn || tn < 1) errs.totalSessions = "Sedute totali ≥ 1";
    const sn = parseInt(startSession, 10);
    if (!sn || sn < 1 || (tn && sn > tn)) errs.startSession = "Seduta iniziale tra 1 e totale";
    if (isEdit && tn && tn < completedOriginal) {
      errs.totalSessions = `Non puoi scendere sotto le sedute già effettuate (${completedOriginal}).`;
    }
    if (pricePaid !== "" && Number(pricePaid) < 0) errs.pricePaid = "Prezzo ≥ 0";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [composition, totalSessions, startSession, pricePaid, customer, isEdit, completedOriginal, name]);

  // ── Payload builder (contract unchanged) ───────────────────────────────────
  const buildPayload = useCallback(() => {
    const tn = parseInt(totalSessions, 10);
    const sn = parseInt(startSession, 10);
    const sessionsRemaining = isEdit ? Math.max(0, tn - completedOriginal) : Math.max(0, tn - (sn - 1));
    // Fall back to derivedName so single-row packages picked via the service
    // picker (which doesn't auto-fill `name`) get a sensible label instead of
    // "Pacchetto senza nome". Multi-row packages still require an explicit
    // name via validation, so derivedName is null there and the fallback is
    // a no-op.
    const resolvedName = name.trim() || (derivedName ? derivedName.trim() : "");
    return {
      clientName: customer.fullName.trim(),
      linkedUserId: null,
      customPackageName: resolvedName || null,
      serviceOptionId: null,
      totalSessions: tn,
      startSession: sn,
      sessionsRemaining,
      sessionDurationMin: sessionDurationMin ?? null,
      pricePaid: pricePaid !== "" ? Number(pricePaid) : null,
      paidUpfront,
      notes: notes.trim() || null,
      items: composition.map((row, i) => ({
        serviceId: row.kind === "service" ? row.serviceId : null,
        serviceOptionId: row.kind === "service" ? (row.serviceOptionId ?? null) : null,
        customName: row.kind === "custom" ? row.customName.trim() : null,
        position: i,
      })),
    };
  }, [composition, customer, isEdit, completedOriginal, name, derivedName, notes, paidUpfront, pricePaid, sessionDurationMin, startSession, totalSessions]);

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitted(true);
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = buildPayload();
      const saved = isEdit ? await updatePackageAssignment(editingPackage.id, payload) : await createPackageAssignment(payload);
      // V64 M1: optionally persist the same composition as a reusable recurring template.
      if (!isEdit && saveAsRecurring) {
        try {
          await createRecurringTemplate({
            name: payload.customPackageName || "Pacchetto",
            defaultPrice: payload.pricePaid,
            defaultDurationMin: payload.sessionDurationMin,
            notes: payload.notes,
            items: payload.items,
          });
          // Refresh the in-memory list so the new template is immediately pickable.
          await fetchRecurringTemplates().then(setRecurringTemplates);
        } catch {
          // Best-effort: a template failure must not block the saved assignment.
        }
      }
      seedSigRef.current = null;
      onSaved?.(saved);
    } catch (err) {
      setSubmitError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCatalog = useMemo(() => {
    const needle = catalogSearch.trim().toLowerCase();
    if (!needle) return catalogPackages;
    return catalogPackages.filter(
      opt => (opt.optionName || "").toLowerCase().includes(needle) || (opt.serviceName || "").toLowerCase().includes(needle),
    );
  }, [catalogPackages, catalogSearch]);

  const filteredTemplates = useMemo(() => {
    const needle = catalogSearch.trim().toLowerCase();
    if (!needle) return recurringTemplates;
    return recurringTemplates.filter(t => (t.name || "").toLowerCase().includes(needle));
  }, [recurringTemplates, catalogSearch]);

  // ── Render ──────────────────────────────────────────────────────────────────
  // The "Nuovo / Modifica pacchetto" page-level heading lives in PackagesTab —
  // intentionally NOT repeated here.
  return (
    <form onSubmit={handleSubmit} className="pkgf-form" noValidate>
      {/* Mode pills — create only */}
      {!isEdit && (
        <div className="nad-pkg-mode-toggle">
          <button type="button" className={`nad-pkg-mode-pill${mode === "catalog" ? " is-active" : ""}`} onClick={() => switchMode("catalog")}>
            Da catalogo
          </button>
          <button type="button" className={`nad-pkg-mode-pill${mode === "service" ? " is-active" : ""}`} onClick={() => switchMode("service")}>
            Da servizio
          </button>
          <button type="button" className={`nad-pkg-mode-pill${mode === "recurring" ? " is-active" : ""}`} onClick={() => switchMode("recurring")}>
            Ricorrenti
          </button>
        </div>
      )}

      {/* Catalog mode: pre-built packages picker (single-pick prefill) */}
      {!isEdit && mode === "catalog" && (
        <div className="pkgf-section">
          <input
            type="text"
            className="nad-form__input"
            placeholder="Cerca pacchetto…"
            value={catalogSearch}
            onChange={e => setCatalogSearch(e.target.value)}
          />
          <div className="nad-pkg-list">
            {filteredCatalog.length === 0 && <div className="nad-help">Nessun pacchetto a catalogo.</div>}
            {filteredCatalog.map(opt => (
              <button
                key={opt.optionId}
                type="button"
                className={`nad-pkg-item${composition[0]?.serviceOptionId === opt.optionId ? " is-selected" : ""}`}
                onClick={() => handleCatalogPick(opt)}
              >
                <span className="nad-pkg-item__name">
                  {opt.optionName}
                  {opt.serviceName ? ` · ${opt.serviceName}` : ""}
                </span>
                {opt.sessions != null && <span className="nad-pkg-item__sessions">{opt.sessions} sed.</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recurring templates picker (single-pick → seeds the editable service form) */}
      {!isEdit && mode === "recurring" && (
        <div className="pkgf-section">
          <input
            type="text"
            className="nad-form__input"
            placeholder="Cerca template…"
            value={catalogSearch}
            onChange={e => setCatalogSearch(e.target.value)}
          />
          <div className="nad-pkg-list">
            {filteredTemplates.length === 0 && <div className="nad-help">Nessun template ricorrente salvato.</div>}
            {filteredTemplates.map(t => (
              <button key={t.id} type="button" className="nad-pkg-item" onClick={() => handleRecurringPick(t)}>
                <span className="nad-pkg-item__name">{t.name}</span>
                {Array.isArray(t.items) && t.items.length > 0 && <span className="nad-pkg-item__sessions">{t.items.length} voci</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Service mode (and edit mode): full catalog multi-select + custom-row affordance */}
      {(isEdit || mode === "service") && (
        <div className="pkgf-section">
          <ServicePicker services={services} selectedKeys={selectedServiceKeys} onPick={toggleServiceRow} />
          <button type="button" className="nad-add-service" onClick={addEmptyCustomRow}>
            + Riga personalizzata
          </button>
        </div>
      )}

      {/* Composition — visible whenever there's at least one row */}
      {composition.length > 0 && (
        <div className="pkgf-section">
          <div className="pkgf-section__title">Composizione</div>
          {showTemplateHint && <div className="nad-help">Modello — modifica liberamente.</div>}
          {composition.map((row, idx) => (
            <div key={row.uid} className={`pkgf-row${submitted && errors[row.uid] ? " has-error" : ""}`}>
              <span className="pkgf-row__index">{idx + 1}</span>
              {row.kind === "service" ? (
                <span className="pkgf-row__name">
                  {row.customName || (() => {
                    const svc = services.find(s => String(s.serviceId) === String(row.serviceId));
                    return svc?.title ?? "Servizio";
                  })()}
                </span>
              ) : (
                <input
                  type="text"
                  className="nad-form__input pkgf-row__input"
                  value={row.customName}
                  onChange={e => updateCustomRow(row.uid, e.target.value)}
                  placeholder="Trattamento personalizzato"
                  maxLength={255}
                />
              )}
              <button type="button" className="pkgf-row__remove" onClick={() => removeRow(row.uid)} aria-label="Rimuovi riga">
                ✕
              </button>
              {submitted && errors[row.uid] && <span className="pkgf-row__error">{errors[row.uid]}</span>}
            </div>
          ))}
        </div>
      )}

      {submitted && errors.composition && <div className="nad-field-error">{errors.composition}</div>}

      {/* Name — always editable. Auto-derive when single row, required when multi-row. */}
      <div className="pkgf-section">
        <div className="nad-form__row">
          <label className="nad-form__label">Nome pacchetto{composition.length > 1 ? " *" : ""}</label>
          <input
            type="text"
            className="nad-form__input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={derivedName ? `${derivedName} (auto)` : "Es. Pacchetto laser gambe"}
            maxLength={255}
          />
          {submitted && errors.name && <div className="nad-field-error">{errors.name}</div>}
          {composition.length === 1 && !name.trim() && derivedName && (
            <div className="nad-help">Lascia vuoto per usare «{derivedName}», oppure scrivine uno diverso.</div>
          )}
        </div>
      </div>

      {/* Sessions */}
      <div className="pkgf-section">
        <div className="pkgf-section__title">Sedute</div>
        <div className="nad-form__row nad-form__row--2col">
          <div>
            <label className="nad-form__label">Sedute totali *</label>
            <input
              type="number"
              className="nad-form__input"
              value={totalSessions}
              onChange={e => setTotalSessions(e.target.value)}
              min={isEdit ? completedOriginal : 1}
              max={999}
            />
            {submitted && errors.totalSessions && <div className="nad-field-error">{errors.totalSessions}</div>}
          </div>
          <div>
            <label className="nad-form__label">Seduta iniziale *</label>
            <input
              type="number"
              className="nad-form__input"
              value={startSession}
              onChange={e => setStartSession(e.target.value)}
              min={1}
              max={totalNum || 999}
            />
            {submitted && errors.startSession && <div className="nad-field-error">{errors.startSession}</div>}
          </div>
        </div>
        <div className="pkgf-readout">
          Sedute già effettuate: <strong>{doneFromStart}</strong> · Rimanenti: <strong>{remaining}</strong>
          {isEdit && completedOriginal !== doneFromStart && (
            <span className="pkgf-readout__note"> · originali completate: {completedOriginal}</span>
          )}
        </div>
      </div>

      {/* Duration per session */}
      <div className="pkgf-section">
        <DurationField
          label="Durata per seduta (opzionale)"
          value={sessionDurationMin}
          onChange={setSessionDurationMin}
          required={false}
          helperText="Override applicato a ogni seduta del pacchetto."
        />
      </div>

      {/* Price */}
      <div className="pkgf-section">
        <div className="pkgf-section__title">Prezzo</div>
        <div className="nad-form__row">
          <label className="nad-form__label">Prezzo pagato (€)</label>
          <input
            type="number"
            className="nad-form__input"
            value={pricePaid}
            onChange={e => setPricePaid(e.target.value)}
            min={0}
            step={0.5}
            placeholder="Opzionale"
          />
          {submitted && errors.pricePaid && <div className="nad-field-error">{errors.pricePaid}</div>}
        </div>
        {fullPriceData && (
          <div className="pkgf-discounts">
            <span className="pkgf-discounts__label">Sconto rapido:</span>
            {DISCOUNT_CHIPS.map(pct => (
              <button key={pct} type="button" className="nad-chip" onClick={() => applyDiscount(pct)}>
                -{Math.round(pct * 100)}%
              </button>
            ))}
          </div>
        )}
        {priceCalc && (
          <div className="nad-price-calc">
            {fullPriceData && (
              <span className="nad-price-calc__ref">
                Listino: €{fullPriceData.total.toFixed(2)} ({totalNum} sed.)
              </span>
            )}
            <span className="nad-price-calc__pps">€{priceCalc.perSession.toFixed(2)} / seduta</span>
            {priceCalc.savings != null && priceCalc.savings > 0 && (
              <span className="nad-price-calc__savings">
                Risparmio €{priceCalc.savings.toFixed(2)} · {priceCalc.discountPct.toFixed(1)}%
              </span>
            )}
          </div>
        )}
        <label className="pkgf-paid">
          <input type="checkbox" checked={paidUpfront} onChange={e => setPaidUpfront(e.target.checked)} />
          <span>💵 Pagato in anticipo</span>
        </label>
        {!isEdit && mode === "service" && (
          <label className="pkgf-paid">
            <input type="checkbox" checked={saveAsRecurring} onChange={e => setSaveAsRecurring(e.target.checked)} />
            <span>♻️ Salva anche come pacchetto ricorrente</span>
          </label>
        )}
      </div>

      {/* Notes */}
      <div className="pkgf-section">
        <div className="nad-form__row">
          <label className="nad-form__label">Note (opzionale)</label>
          <textarea
            className="nad-form__textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Note sul pacchetto…"
            maxLength={1000}
          />
        </div>
      </div>

      {submitted && errors.customer && <div className="nad-form__error">{errors.customer}</div>}
      {submitError && (
        <div className="nad-form__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="nad-form__actions">
        <button type="submit" className="nad-btn nad-btn--primary" disabled={submitting}>
          {submitting ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Crea pacchetto"}
        </button>
      </div>
    </form>
  );
}
