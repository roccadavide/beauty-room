import { useCallback, useEffect, useState, useRef } from "react";
import { Container } from "react-bootstrap";
import * as api from "../../api/modules/impostazioni.api";
import { fetchCancellationPolicy, patchCancellationHoursLimit } from "../../api/modules/users.api";
import SEO from "../common/SEO";
import DateTimeField from "../common/DateTimeField";

/* ============================================================
   CONSTANTS
   ============================================================ */

const DOW_IT = {
  MONDAY: "Lunedì",
  TUESDAY: "Martedì",
  WEDNESDAY: "Mercoledì",
  THURSDAY: "Giovedì",
  FRIDAY: "Venerdì",
  SATURDAY: "Sabato",
  SUNDAY: "Domenica",
};

const DOW_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function validateWH(form) {
  if (form.closed) return "";
  const hasAm = form.morningStart && form.morningEnd;
  const hasPm = form.hasPm && form.afternoonStart && form.afternoonEnd;

  if (!form.morningStart && !form.morningEnd && !form.afternoonStart && !form.afternoonEnd) {
    return "Almeno una fascia oraria è obbligatoria.";
  }
  if ((form.morningStart && !form.morningEnd) || (!form.morningStart && form.morningEnd)) {
    return "Completare entrambi gli orari della fascia mattina.";
  }
  if (form.hasPm && ((form.afternoonStart && !form.afternoonEnd) || (!form.afternoonStart && form.afternoonEnd))) {
    return "Completare entrambi gli orari della fascia pomeriggio.";
  }
  if (hasAm && form.morningStart >= form.morningEnd) {
    return "L'orario di fine mattina deve essere dopo l'inizio.";
  }
  if (hasPm && form.afternoonStart >= form.afternoonEnd) {
    return "L'orario di fine pomeriggio deve essere dopo l'inizio.";
  }
  if (hasAm && hasPm && form.morningEnd >= form.afternoonStart) {
    return "La fascia pomeriggio deve iniziare dopo la fine della mattina.";
  }
  return "";
}

/** Genera una chiave URL-safe dal nome (es. "Laser Viso" → "laser-viso") */
function labelToCategoryKey(label) {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortCategories(list) {
  return [...list].sort((a, b) => (a.label || "").localeCompare(b.label || "", "it"));
}

/* ============================================================
   DayCard — per-day working hours editor
   ============================================================ */

function DayCard({ wh, onSave }) {
  const [form, setForm] = useState({
    dayOfWeek: wh.dayOfWeek,
    closed: wh.closed,
    morningStart: wh.morningStart || "",
    morningEnd: wh.morningEnd || "",
    afternoonStart: wh.afternoonStart || "",
    afternoonEnd: wh.afternoonEnd || "",
    hasPm: !!(wh.afternoonStart && wh.afternoonEnd),
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const successTimerRef = useRef(null);

  useEffect(() => {
    setForm({
      dayOfWeek: wh.dayOfWeek,
      closed: wh.closed,
      morningStart: wh.morningStart || "",
      morningEnd: wh.morningEnd || "",
      afternoonStart: wh.afternoonStart || "",
      afternoonEnd: wh.afternoonEnd || "",
      hasPm: !!(wh.afternoonStart && wh.afternoonEnd),
    });
  }, [wh]);

  useEffect(() => () => clearTimeout(successTimerRef.current), []);

  const setField = useCallback((key, val) => setForm(f => ({ ...f, [key]: val })), []);

  const handleSave = async () => {
    const validationErr = validateWH(form);
    if (validationErr) { setError(validationErr); return; }
    setError("");
    setLoading(true);

    const payload = {
      dayOfWeek: form.dayOfWeek,
      closed: form.closed,
      morningStart: form.closed ? null : (form.morningStart || null),
      morningEnd: form.closed ? null : (form.morningEnd || null),
      afternoonStart: form.closed || !form.hasPm ? null : (form.afternoonStart || null),
      afternoonEnd: form.closed || !form.hasPm ? null : (form.afternoonEnd || null),
    };

    try {
      await onSave(wh.id, payload);
      setSuccess(true);
      clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e.message || "Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`imp-day-card${form.closed ? " imp-day-card--closed" : ""}`}>
      {/* Header */}
      <div className="imp-day-header">
        <span className="imp-day-name">{DOW_IT[wh.dayOfWeek]}</span>
        <label className="imp-toggle">
          <input
            type="checkbox"
            checked={!form.closed}
            onChange={e => setField("closed", !e.target.checked)}
          />
          <span className="imp-toggle__track" />
          <span className="imp-toggle__label">{form.closed ? "Chiuso" : "Aperto"}</span>
        </label>
      </div>

      {/* Body — shown only when open */}
      {!form.closed && (
        <div className="imp-day-body">
          <div className="imp-slot-label">Mattina</div>
          <div className="imp-time-row">
            <div className="imp-time-group">
              <DateTimeField
                className="imp-dtf-time"
                label="Dalle"
                mode="time"
                value={form.morningStart}
                onChange={v => setField("morningStart", v)}
                placeholder="—:—"
              />
            </div>
            <span className="imp-time-sep">→</span>
            <div className="imp-time-group">
              <DateTimeField
                className="imp-dtf-time"
                label="Alle"
                mode="time"
                value={form.morningEnd}
                onChange={v => setField("morningEnd", v)}
                placeholder="—:—"
              />
            </div>
          </div>

          <div className="imp-pm-toggle-row">
            <label className="imp-checkbox-label">
              <input
                type="checkbox"
                checked={form.hasPm}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    hasPm: e.target.checked,
                    afternoonStart: e.target.checked ? f.afternoonStart : "",
                    afternoonEnd: e.target.checked ? f.afternoonEnd : "",
                  }))
                }
              />
              Aggiungi fascia pomeriggio
            </label>
          </div>

          {form.hasPm && (
            <>
              <div className="imp-slot-label">Pomeriggio</div>
              <div className="imp-time-row">
                <div className="imp-time-group">
                  <DateTimeField
                    className="imp-dtf-time"
                    label="Dalle"
                    mode="time"
                    value={form.afternoonStart}
                    onChange={v => setField("afternoonStart", v)}
                    placeholder="—:—"
                  />
                </div>
                <span className="imp-time-sep">→</span>
                <div className="imp-time-group">
                  <DateTimeField
                    className="imp-dtf-time"
                    label="Alle"
                    mode="time"
                    value={form.afternoonEnd}
                    onChange={v => setField("afternoonEnd", v)}
                    placeholder="—:—"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {error && <div className="imp-field-error">{error}</div>}

      <div className="imp-save-row">
        <button className="imp-save-btn" onClick={handleSave} disabled={loading}>
          {loading ? "Salvataggio…" : "Salva"}
        </button>
        {success && <span className="imp-save-ok">✓ Salvato</span>}
      </div>
    </div>
  );
}

/* ============================================================
   CategoryForm — inline create / edit
   ============================================================ */

function CategoryForm({ initial, onSave, onCancel }) {
  const isEdit = !!initial?.categoryId;

  const [form, setForm] = useState({
    label: initial?.label || "",
    categoryKey: initial?.categoryKey || "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm({
      label: initial?.label || "",
      categoryKey: initial?.categoryKey || "",
    });
  }, [initial]);

  const setField = useCallback((key, val) => setForm(f => ({ ...f, [key]: val })), []);

  const validate = () => {
    const label = form.label.trim();
    const categoryKey = form.categoryKey.trim().toLowerCase();
    if (!label) return "Inserisci un nome.";
    if (label.length > 100) return "Il nome non può superare i 100 caratteri.";
    if (!categoryKey) return "Inserisci una chiave.";
    if (categoryKey.length > 50) return "La chiave non può superare i 50 caratteri.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categoryKey)) {
      return "La chiave può contenere solo lettere minuscole, numeri e trattini (es. laser-viso).";
    }
    return "";
  };

  const handleGenerateKey = () => {
    setField("categoryKey", labelToCategoryKey(form.label));
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);

    const payload = {
      label: form.label.trim(),
      categoryKey: form.categoryKey.trim().toLowerCase(),
    };

    try {
      await onSave(initial?.categoryId || null, payload);
    } catch (e) {
      setError(e.message || "Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="imp-closure-form">
      <div className="imp-form-title">{isEdit ? "✏️ Modifica categoria" : "➕ Nuova categoria"}</div>

      <div className="imp-form-row">
        <div className="imp-form-group imp-form-group--full">
          <label className="imp-form-label">
            Nome{" "}
            <span className="imp-char-count">{form.label.length}/100</span>
          </label>
          <input
            type="text"
            className="imp-form-input"
            maxLength={100}
            placeholder="es. Laser viso"
            value={form.label}
            onChange={e => setField("label", e.target.value)}
          />
        </div>
      </div>

      <div className="imp-form-row imp-form-row--times">
        <div className="imp-form-group">
          <label className="imp-form-label">Chiave</label>
          <input
            type="text"
            className="imp-form-input"
            maxLength={50}
            placeholder="es. laser-viso"
            autoComplete="off"
            value={form.categoryKey}
            onChange={e => setField("categoryKey", e.target.value)}
          />
        </div>
        <div className="imp-form-group">
          <label className="imp-form-label"> </label>
          <button type="button" className="imp-btn imp-btn--ghost" onClick={handleGenerateKey}>
            Genera
          </button>
        </div>
      </div>

      <p className="imp-form-hint">
        Solo lettere minuscole, numeri e trattini. Usa &quot;Genera&quot; dal nome oppure scrivila a mano.
      </p>

      {error && <div className="imp-field-error">{error}</div>}

      <div className="imp-form-actions">
        {isEdit && (
          <button type="button" className="imp-btn imp-btn--ghost" onClick={onCancel}>
            Annulla
          </button>
        )}
        <button type="button" className="imp-btn imp-btn--primary" onClick={handleSave} disabled={loading}>
          {loading ? "Salvataggio…" : "Salva categoria"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ImpostazioniPage — main component
   ============================================================ */

export default function ImpostazioniPage() {
  const [tab, setTab] = useState("orari");
  const [workingHours, setWorkingHours] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");

  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryDeleteConfirm, setCategoryDeleteConfirm] = useState(null);
  const [categoryDeleteLoading, setCategoryDeleteLoading] = useState(false);

  // ── Politiche ──
  const [cancellationHours, setCancellationHours] = useState(24);
  const [cancellationSaving, setCancellationSaving] = useState(false);
  const [cancellationMsg, setCancellationMsg] = useState(null);

  const sortWH = list =>
    [...list].sort((a, b) => DOW_ORDER.indexOf(a.dayOfWeek) - DOW_ORDER.indexOf(b.dayOfWeek));

  const load = useCallback(async () => {
    setGlobalError("");
    try {
      const whData = await api.getWorkingHours();

      if (whData.length === 0) {
        await api.initDefaultWeek();
        const fresh = await api.getWorkingHours();
        setWorkingHours(sortWH(fresh));
      } else {
        setWorkingHours(sortWH(whData));
      }
    } catch (e) {
      setGlobalError(e.message || "Errore durante il caricamento.");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== "politiche") return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCancellationPolicy();
        if (!cancelled) setCancellationHours(data.cancellationHoursLimit ?? 24);
      } catch {
        // silently ignore — keep default
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    if (tab !== "categorie") return undefined;
    let cancelled = false;
    (async () => {
      setCategoriesLoading(true);
      setGlobalError("");
      try {
        const data = await api.getCategories();
        if (!cancelled) setCategories(sortCategories(data));
      } catch (e) {
        if (!cancelled) setGlobalError(e.message || "Errore durante il caricamento delle categorie.");
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  /* ── WH save ── */
  const handleSaveWH = useCallback(async (id, payload) => {
    await api.updateWorkingHours(id, payload);
    const fresh = await api.getWorkingHours();
    setWorkingHours(sortWH(fresh));
  }, []);

  const refreshCategories = useCallback(async () => {
    const fresh = await api.getCategories();
    setCategories(sortCategories(fresh));
  }, []);

  const handleSaveCategory = useCallback(async (categoryId, payload) => {
    if (categoryId) {
      await api.updateCategory(categoryId, payload);
    } else {
      await api.createCategory(payload);
    }
    setShowCategoryForm(false);
    setEditingCategory(null);
    await refreshCategories();
  }, [refreshCategories]);

  const handleDeleteCategory = async categoryId => {
    setCategoryDeleteLoading(true);
    try {
      await api.deleteCategory(categoryId);
      setCategoryDeleteConfirm(null);
      await refreshCategories();
    } catch (e) {
      setGlobalError(e.message || "Errore durante l'eliminazione.");
    } finally {
      setCategoryDeleteLoading(false);
    }
  };

  const openCategoryNew = () => {
    setEditingCategory(null);
    setShowCategoryForm(true);
  };

  const openCategoryEdit = cat => {
    setEditingCategory(cat);
    setShowCategoryForm(true);
  };

  const cancelCategoryForm = () => {
    setShowCategoryForm(false);
    setEditingCategory(null);
  };

  /* ── Loading screen ── */
  if (pageLoading) {
    return (
      <div className="imp-page">
        <Container className="imp-container">
          <div className="imp-loading">Caricamento impostazioni…</div>
        </Container>
      </div>
    );
  }

  return (
    <div className="imp-page">
      <SEO title="Impostazioni" noindex={true} />
      <Container className="imp-container">

        {/* ── Header ── */}
        <div className="imp-header">
          <h1 className="imp-title">Impostazioni</h1>
          <p className="imp-subtitle">
            Gestisci orari di apertura e categorie servizi
          </p>
        </div>

        {/* ── Global error ── */}
        {globalError && (
          <div className="imp-global-error">{globalError}</div>
        )}

        {/* ── Tab pills ── */}
        <div className="imp-tabs">
          <button
            type="button"
            className={`imp-tab-pill${tab === "orari" ? " imp-tab-pill--active" : ""}`}
            onClick={() => setTab("orari")}
          >
            🕐 Orari
          </button>
          <button
            type="button"
            className={`imp-tab-pill${tab === "categorie" ? " imp-tab-pill--active" : ""}`}
            onClick={() => setTab("categorie")}
          >
            🏷️ Categorie
          </button>
          <button
            type="button"
            className={`imp-tab-pill${tab === "politiche" ? " imp-tab-pill--active" : ""}`}
            onClick={() => setTab("politiche")}
          >
            ⚙️ Politiche
          </button>
        </div>

        {/* ══════════════════════════════════
            ORARI TAB
            ══════════════════════════════════ */}
        {tab === "orari" && (
          <div className="imp-section">
            <div className="imp-section-header">
              <div>
                <div className="imp-section-title">Orari settimanali</div>
                <div className="imp-section-sub">
                  Ogni giorno ha un pulsante &quot;Salva&quot; indipendente
                </div>
              </div>
            </div>

            <div className="imp-day-grid">
              {workingHours.map(wh => (
                <DayCard key={wh.id} wh={wh} onSave={handleSaveWH} />
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            CATEGORIE TAB
            ══════════════════════════════════ */}
        {tab === "categorie" && (
          <div className="imp-section">
            <div className="imp-section-header">
              <div>
                <div className="imp-section-title">Categorie servizi</div>
                <div className="imp-section-sub">
                  {categoriesLoading ? "Caricamento in corso…" : `${categories.length} categorie`}
                </div>
              </div>
              {!showCategoryForm && !categoriesLoading && (
                <button type="button" className="imp-btn imp-btn--primary" onClick={openCategoryNew}>
                  + Aggiungi categoria
                </button>
              )}
            </div>

            {showCategoryForm && (
              <CategoryForm
                initial={editingCategory}
                onSave={handleSaveCategory}
                onCancel={cancelCategoryForm}
              />
            )}

            {!categoriesLoading && categories.length === 0 && !showCategoryForm && (
              <div className="imp-empty">
                Nessuna categoria — aggiungine una per organizzare i servizi.
              </div>
            )}

            {!categoriesLoading && categories.length > 0 && (
              <div className="imp-closure-list">
                {categories.map(cat => (
                  <div
                    key={cat.categoryId}
                    className={`imp-closure-card${editingCategory?.categoryId === cat.categoryId ? " imp-closure-card--editing" : ""}`}
                  >
                    <div className="imp-closure-info">
                      <div className="imp-closure-date">{cat.label}</div>
                      <div className="imp-closure-meta">
                        <span className="imp-badge imp-badge--partial">{cat.categoryKey}</span>
                      </div>
                    </div>

                    <div className="imp-closure-actions">
                      <button
                        type="button"
                        className="imp-btn imp-btn--sm imp-btn--ghost"
                        onClick={() => openCategoryEdit(cat)}
                      >
                        Modifica
                      </button>

                      {categoryDeleteConfirm === cat.categoryId ? (
                        <>
                          <span className="imp-delete-confirm-text">Sei sicura?</span>
                          <button
                            type="button"
                            className="imp-btn imp-btn--sm imp-btn--danger"
                            onClick={() => handleDeleteCategory(cat.categoryId)}
                            disabled={categoryDeleteLoading}
                          >
                            {categoryDeleteLoading ? "…" : "Sì, elimina"}
                          </button>
                          <button
                            type="button"
                            className="imp-btn imp-btn--sm imp-btn--ghost"
                            onClick={() => setCategoryDeleteConfirm(null)}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="imp-btn imp-btn--sm imp-btn--danger-ghost"
                          onClick={() => setCategoryDeleteConfirm(cat.categoryId)}
                        >
                          Elimina
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════
            POLITICHE TAB
            ══════════════════════════════════ */}
        {tab === "politiche" && (
          <div className="imp-section">
            <div className="imp-section-header">
              <div>
                <div className="imp-section-title">Politiche di cancellazione</div>
                <div className="imp-section-sub">
                  Limite entro cui il cliente può annullare gratuitamente
                </div>
              </div>
            </div>

            <div className="imp-closure-form" style={{ maxWidth: 420 }}>
              <div className="imp-form-row">
                <div className="imp-form-group imp-form-group--full">
                  <label className="imp-form-label">
                    Ore di preavviso minimo per cancellazione
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <input
                      type="number"
                      className="imp-form-input"
                      min={0}
                      max={168}
                      value={cancellationHours}
                      onChange={e => setCancellationHours(Number(e.target.value))}
                      style={{ width: 90 }}
                    />
                    <span style={{ color: "var(--imp-muted, #888)", fontSize: "0.875rem" }}>ore</span>
                  </div>
                  <p className="imp-form-hint">
                    Valore 0 = nessun limite. Massimo 168 ore (7 giorni).
                  </p>
                </div>
              </div>

              {cancellationMsg && (
                <div
                  className={`imp-field-error${cancellationMsg.ok ? " imp-save-ok" : ""}`}
                  style={cancellationMsg.ok ? { color: "var(--imp-green, #3a9e6a)" } : {}}
                >
                  {cancellationMsg.text}
                </div>
              )}

              <div className="imp-form-actions">
                <button
                  type="button"
                  className="imp-btn imp-btn--primary"
                  disabled={cancellationSaving}
                  onClick={async () => {
                    setCancellationSaving(true);
                    setCancellationMsg(null);
                    try {
                      await patchCancellationHoursLimit(cancellationHours);
                      setCancellationMsg({ ok: true, text: "✓ Salvato" });
                      setTimeout(() => setCancellationMsg(null), 3000);
                    } catch (e) {
                      setCancellationMsg({ ok: false, text: e.message || "Errore durante il salvataggio." });
                    } finally {
                      setCancellationSaving(false);
                    }
                  }}
                >
                  {cancellationSaving ? "Salvataggio…" : "Salva"}
                </button>
              </div>
            </div>
          </div>
        )}

      </Container>
    </div>
  );
}
