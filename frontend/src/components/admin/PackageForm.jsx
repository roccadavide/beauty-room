import { useCallback, useEffect, useMemo, useState } from "react";
import DurationField from "../common/DurationField";
import { createPackageAssignment, fetchCatalogPackages, updatePackageAssignment } from "../../api/modules/adminAgenda.api";
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

// ── ServicePicker ─────────────────────────────────────────────────────────────
// Compact catalog picker mirroring AppointmentForm's .ag-service-list pattern.
// Used both for "Da servizio" mode-pick and for adding composition rows.
function ServicePicker({ services, onPick }) {
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
                    {opts.map(opt => (
                      <button
                        key={opt.optionId ?? opt.id}
                        type="button"
                        className="ag-service-option-item"
                        onClick={() => onPick(s, opt)}
                      >
                        <span className="ag-service-option-item__name">{opt.name}</span>
                        <span className="ag-service-item__meta">
                          {opt.price != null ? `€${Number(opt.price).toFixed(0)}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <button key={s.serviceId} type="button" className="ag-service-item" onClick={() => onPick(s, null)}>
              <span className="ag-service-item__title">{s.title}</span>
              <span className="ag-service-item__meta">{s.price != null ? `€${Number(s.price).toFixed(0)}` : ""}</span>
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

  // Original completed sessions — frozen for the duration of this edit session
  // (matches backend update() guard: req.totalSessions cannot fall below completed).
  const completedOriginal = useMemo(
    () => (isEdit ? Math.max(0, (editingPackage.totalSessions ?? 0) - (editingPackage.sessionsRemaining ?? 0)) : 0),
    [isEdit, editingPackage],
  );

  // ── State ───────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState(isEdit ? "service" : "catalog");
  const [name, setName] = useState("");
  const [composition, setComposition] = useState([]);
  const [totalSessions, setTotalSessions] = useState("1");
  const [startSession, setStartSession] = useState("1");
  const [sessionDurationMin, setSessionDurationMin] = useState(null);
  const [pricePaid, setPricePaid] = useState("");
  const [paidUpfront, setPaidUpfront] = useState(false);
  const [notes, setNotes] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);
  const [addRowKind, setAddRowKind] = useState("service");

  // Mode-pick UI state
  const [catalogPackages, setCatalogPackages] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  // ── Fetch catalog packages once ─────────────────────────────────────────────
  useEffect(() => {
    fetchCatalogPackages()
      .then(opts => setCatalogPackages(opts || []))
      .catch(() => setCatalogPackages([]));
  }, []);

  // ── Prefill from editingPackage (or reset to defaults) ──────────────────────
  useEffect(() => {
    if (isEdit) {
      setMode("service");
      setName(editingPackage.customPackageName ?? editingPackage.displayName ?? "");
      const items = Array.isArray(editingPackage.items) ? [...editingPackage.items].sort((a, b) => a.position - b.position) : [];
      setComposition(
        items.length > 0
          ? items.map(it =>
              it.serviceId || it.serviceOptionId
                ? newServiceRow({ serviceId: it.serviceId ?? "", serviceOptionId: it.serviceOptionId ?? null, customName: it.serviceOptionName || it.serviceTitle || "" })
                : newCustomRow({ customName: it.customName ?? "" }),
            )
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
    setShowAddRow(false);
    setAddRowKind("service");
    setSubmitted(false);
    setErrors({});
    setSubmitError("");
  }, [editingPackage, isEdit]);

  // ── Mode switch resets form ────────────────────────────────────────────────
  const switchMode = useCallback(next => {
    setMode(next);
    setName("");
    setComposition([]);
    setTotalSessions("1");
    setStartSession("1");
    setSessionDurationMin(null);
    setPricePaid("");
    setCatalogSearch("");
    setShowAddRow(false);
  }, []);

  // ── "Da catalogo" pick ──────────────────────────────────────────────────────
  // Look up the option's durationMin from the `services` catalog (PackageResponseDTO
  // does not expose it). If not found, leave duration unset — the admin can still
  // fill DurationField manually.
  const handleCatalogPick = useCallback(
    opt => {
      const svc = services.find(s => String(s.serviceId) === String(opt.serviceId));
      let optDuration = null;
      if (svc) {
        const allOpts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
        const match = allOpts.find(o => String(o.optionId ?? o.id) === String(opt.optionId));
        optDuration = match?.durationMin ?? null;
      }
      setName(opt.optionName ?? "");
      setComposition([
        newServiceRow({
          serviceId: opt.serviceId,
          serviceOptionId: opt.optionId,
          customName: opt.optionName ?? "",
        }),
      ]);
      setTotalSessions(opt.sessions != null ? String(opt.sessions) : "1");
      setStartSession("1");
      setSessionDurationMin(optDuration);
      setPricePaid(opt.price != null ? String(opt.price) : "");
    },
    [services],
  );

  // ── "Da servizio" pick ──────────────────────────────────────────────────────
  const handleServicePick = useCallback((svc, opt) => {
    const title = opt ? `${svc.title} · ${opt.name}` : svc.title;
    setName(prev => (prev ? prev : title));
    setComposition(prev => [
      ...prev,
      newServiceRow({
        serviceId: svc.serviceId,
        serviceOptionId: opt ? (opt.optionId ?? opt.id) : null,
        customName: title,
      }),
    ]);
  }, []);

  // ── Composition row helpers ────────────────────────────────────────────────
  const removeRow = useCallback(uid => setComposition(prev => prev.filter(r => r.uid !== uid)), []);
  const addCustomRow = useCallback(name => {
    setComposition(prev => [...prev, newCustomRow({ customName: name })]);
  }, []);
  const updateRow = useCallback((uid, patch) => {
    setComposition(prev => prev.map(r => (r.uid === uid ? { ...r, ...patch } : r)));
  }, []);

  // ── Price calc ──────────────────────────────────────────────────────────────
  // Full catalog price = sum over non-custom rows. Use option.price when available,
  // otherwise fall back to service.price. Only valid when every non-custom row
  // contributes a numeric price.
  const fullPriceData = useMemo(() => {
    const serviceRows = composition.filter(r => r.kind === "service");
    if (serviceRows.length === 0) return null;
    let total = 0;
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
      if (p == null) {
        allKnown = false;
      } else {
        total += Number(p);
      }
    }
    return allKnown && total > 0 ? { total, perSession: total / Math.max(1, Number(totalSessions) || 1) } : null;
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

  // ── Sessions readout ────────────────────────────────────────────────────────
  const totalNum = parseInt(totalSessions, 10) || 0;
  const startNum = parseInt(startSession, 10) || 0;
  const doneFromStart = Math.max(0, startNum - 1);
  const remaining = Math.max(0, totalNum - doneFromStart);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    if (!customer?.fullName?.trim()) errs.customer = "Seleziona una cliente prima di creare un pacchetto.";
    if (composition.length === 0) errs.composition = "Aggiungi almeno una riga di composizione.";
    composition.forEach(r => {
      if (r.kind === "service" && !r.serviceId) errs[r.uid] = "Servizio mancante";
      if (r.kind === "custom" && !r.customName.trim()) errs[r.uid] = "Nome obbligatorio";
    });
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
  }, [composition, totalSessions, startSession, pricePaid, customer, isEdit, completedOriginal]);

  // ── Payload builder ─────────────────────────────────────────────────────────
  const buildPayload = useCallback(() => {
    const tn = parseInt(totalSessions, 10);
    const sn = parseInt(startSession, 10);
    // For create: sessionsRemaining = totalSessions - (startSession - 1).
    // For update: anchor on the ORIGINAL completed count so admin edits don't
    // accidentally rewind sessions already burned via booking links.
    const sessionsRemaining = isEdit ? Math.max(0, tn - completedOriginal) : Math.max(0, tn - (sn - 1));
    return {
      clientName: customer.fullName.trim(),
      linkedUserId: null,
      customPackageName: name.trim() || null,
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
  }, [composition, customer, isEdit, completedOriginal, name, notes, paidUpfront, pricePaid, sessionDurationMin, startSession, totalSessions]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitted(true);
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = buildPayload();
      const saved = isEdit ? await updatePackageAssignment(editingPackage.id, payload) : await createPackageAssignment(payload);
      onSaved?.(saved);
    } catch (err) {
      setSubmitError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const filteredCatalog = useMemo(() => {
    const needle = catalogSearch.trim().toLowerCase();
    if (!needle) return catalogPackages;
    return catalogPackages.filter(opt =>
      (opt.optionName || "").toLowerCase().includes(needle) || (opt.serviceName || "").toLowerCase().includes(needle),
    );
  }, [catalogPackages, catalogSearch]);

  return (
    <form onSubmit={handleSubmit} className="pkgf-form" noValidate>
      <div className="pkgf-section">
        <div className="pkgf-section__title">{isEdit ? "Modifica pacchetto" : "Nuovo pacchetto"}</div>

        {/* Mode pills — only in create mode */}
        {!isEdit && (
          <div className="nad-pkg-mode-toggle">
            <button type="button" className={`nad-pkg-mode-pill${mode === "catalog" ? " is-active" : ""}`} onClick={() => switchMode("catalog")}>
              Da catalogo
            </button>
            <button type="button" className={`nad-pkg-mode-pill${mode === "service" ? " is-active" : ""}`} onClick={() => switchMode("service")}>
              Da servizio
            </button>
            <button type="button" className={`nad-pkg-mode-pill${mode === "custom" ? " is-active" : ""}`} onClick={() => switchMode("custom")}>
              Personalizzato
            </button>
          </div>
        )}

        {/* Catalog picker — only in catalog create mode */}
        {!isEdit && mode === "catalog" && (
          <div className="pkgf-catalog">
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

        {/* Name — always editable */}
        <div className="nad-form__row">
          <label className="nad-form__label">Nome pacchetto</label>
          <input
            type="text"
            className="nad-form__input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Es. Pacchetto laser gambe"
            maxLength={255}
          />
        </div>
      </div>

      {/* Composition */}
      <div className="pkgf-section">
        <div className="pkgf-section__title">Composizione</div>
        {composition.length === 0 && <div className="nad-help">Aggiungi almeno una riga.</div>}
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
                onChange={e => updateRow(row.uid, { customName: e.target.value })}
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

        {!showAddRow ? (
          <button type="button" className="nad-add-service" onClick={() => setShowAddRow(true)}>
            + Aggiungi riga
          </button>
        ) : (
          <div className="pkgf-add-row">
            <div className="pkgf-add-row__pills">
              <button
                type="button"
                className={`nad-pkg-mode-pill${addRowKind === "service" ? " is-active" : ""}`}
                onClick={() => setAddRowKind("service")}
              >
                Da catalogo
              </button>
              <button
                type="button"
                className={`nad-pkg-mode-pill${addRowKind === "custom" ? " is-active" : ""}`}
                onClick={() => setAddRowKind("custom")}
              >
                Personalizzato
              </button>
              <button type="button" className="pkgf-add-row__close" onClick={() => setShowAddRow(false)} aria-label="Chiudi">
                ✕
              </button>
            </div>
            {addRowKind === "service" ? (
              <ServicePicker
                services={services}
                onPick={(svc, opt) => {
                  handleServicePick(svc, opt);
                  setShowAddRow(false);
                }}
              />
            ) : (
              <CustomRowInput
                onAdd={n => {
                  addCustomRow(n);
                  setShowAddRow(false);
                }}
              />
            )}
          </div>
        )}
        {submitted && errors.composition && <div className="nad-field-error">{errors.composition}</div>}
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

// ── CustomRowInput (helper) ───────────────────────────────────────────────────
function CustomRowInput({ onAdd }) {
  const [value, setValue] = useState("");
  return (
    <div className="pkgf-custom-input">
      <input
        type="text"
        className="nad-form__input"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Nome trattamento personalizzato"
        maxLength={255}
        autoFocus
      />
      <button
        type="button"
        className="nad-btn nad-btn--primary"
        onClick={() => {
          if (value.trim()) onAdd(value.trim());
        }}
        disabled={!value.trim()}
      >
        Aggiungi
      </button>
    </div>
  );
}
