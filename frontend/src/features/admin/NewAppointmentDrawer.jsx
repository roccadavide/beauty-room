import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CustomerAutocomplete from "../../components/admin/CustomerAutocomplete";
import DateTimeField from "../../components/common/DateTimeField";
import {
  cancelPackageAssignment,
  createMultiServiceBooking,
  createPackageAssignment,
  createPersonalAppointment,
  deletePersonalAppointment,
  fetchCatalogPackages,
  getAdminAvailableSlots,
  getClientPackageAssignmentsByName,
  updateBooking,
  updatePersonalAppointment,
} from "../../api/modules/adminAgenda.api";
import "./NewAppointmentDrawer.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const pad2 = n => String(n).padStart(2, "0");
const WALKIN_MARKER = "@beautyroom.local";
const isWalkInEmail = e => !e || e.includes(WALKIN_MARKER);
const PADDING_PRESETS = [0, 15, 20, 30, 45];
const PERSONAL_DURATION_PRESETS = [
  { value: 30,  label: "30′" },
  { value: 45,  label: "45′" },
  { value: 60,  label: "1h" },
  { value: 90,  label: "1h30′" },
  { value: 120, label: "2h" },
];

// Helper: resolve display name for a package assignment DTO
const pkgDisplayName = pkg =>
  pkg.customPackageName || pkg.serviceName || pkg.serviceOptionName || "Pacchetto";

// Helper: format total minutes into readable string
const formatDuration = mins => {
  if (!mins) return "0 min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

// Factory for a blank service item
const newServiceItem = () => ({
  id: crypto.randomUUID(),
  type: "catalog",       // "catalog" | "custom" | "package"
  // catalog fields
  serviceId: "",
  serviceOptionId: null,
  serviceSearch: "",
  serviceCatFilter: "all",
  // custom fields
  customName: "",
  customDuration: "60",
  customPrice: "",
  // package fields (existing assignment)
  packageAssignmentId: null,
  // new package from catalogue
  newPackageCatalogOption: null, // { optionId, name }
  newPkgSessions: "1",
  newPkgPrice: "",
  newPkgMode: "catalog",   // "catalog" | "custom"
  newPkgCustomName: "",
});

// ══════════════════════════════════════════════════════════════════════════════
// ServiceItemCard — one service in the multi-service builder
// ══════════════════════════════════════════════════════════════════════════════
function ServiceItemCard({
  item,
  index,
  services,
  serviceCategories,
  clientPackages,
  catalogPackages,
  onUpdate,
  onDeletePackage,
  onRemove,
  canRemove,
  error,
}) {
  const filteredServices = useMemo(() => {
    let list = services || [];
    if (item.serviceCatFilter !== "all") {
      list = list.filter(
        s => (s.category ?? s.categoryName ?? s.categoryLabel) === item.serviceCatFilter,
      );
    }
    const needle = item.serviceSearch.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        s =>
          s.title?.toLowerCase().includes(needle) ||
          s.durationMin?.toString().includes(needle) ||
          (s.options || s.serviceOptionList || s.serviceOptions || [])
            .some(o => o.name?.toLowerCase().includes(needle)),
      );
    }
    return list;
  }, [services, item.serviceCatFilter, item.serviceSearch]);

  const selectedService = useMemo(
    () => services.find(s => String(s.serviceId) === String(item.serviceId)),
    [services, item.serviceId],
  );

  // Options for the selected catalog service — package options (sessions > 1) are excluded
  const serviceOpts = useMemo(() => {
    if (!item.serviceId || !selectedService) return [];
    const allOpts = selectedService.options || selectedService.serviceOptionList || selectedService.serviceOptions || [];
    return allOpts.filter(o => o.active !== false && !(o.sessions != null && o.sessions > 1));
  }, [item.serviceId, selectedService]);

  const serviceOptsGrouped = useMemo(() => {
    if (serviceOpts.length === 0) return { entries: [], ungrouped: [] };
    const groups = {};
    const ungrouped = [];
    serviceOpts.forEach(o => {
      const cat = o.optionGroup ?? o.category ?? o.categoryName ?? null;
      if (cat) {
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(o);
      } else {
        ungrouped.push(o);
      }
    });
    return { entries: Object.entries(groups), ungrouped };
  }, [serviceOpts]);

  const durationLabel = useMemo(() => {
    if (item.type === "catalog" && selectedService?.durationMin) {
      return `${selectedService.durationMin} min`;
    }
    if (item.type === "custom") {
      const d = parseInt(item.customDuration, 10);
      return d > 0 ? `${d} min` : null;
    }
    if (item.type === "package") {
      if (item.packageAssignmentId) {
        const pkg = clientPackages.find(p => String(p.id) === String(item.packageAssignmentId));
        if (pkg?.serviceOptionId) {
          const svc = services.find(s =>
            s.options?.some(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId)),
          );
          if (svc?.durationMin) return `${svc.durationMin} min`;
        }
      }
      return null;
    }
    return null;
  }, [item, selectedService, clientPackages, services]);

  const [pkgSearch, setPkgSearch] = useState("");
  const filteredCatalogPackages = catalogPackages.filter(opt =>
    (opt.optionName || opt.name || "").toLowerCase().includes(pkgSearch.toLowerCase())
  );

  const [activePkgSearch, setActivePkgSearch] = useState("");
  const filteredClientPackages = clientPackages.filter(pkg =>
    pkgDisplayName(pkg).toLowerCase().includes(activePkgSearch.toLowerCase())
  );

  const switchType = type => {
    onUpdate({
      type,
      serviceId: "",
      serviceSearch: "",
      serviceCatFilter: "all",
      serviceOptionId: null,
      customName: "",
      customDuration: "60",
      customPrice: "",
      packageAssignmentId: null,
      newPackageCatalogOption: null,
      newPkgSessions: "1",
      newPkgPrice: "",
      newPkgMode: "catalog",
      newPkgCustomName: "",
    });
  };

  const selectPackageAssignment = packageAssignmentId => {
    onUpdate({ packageAssignmentId, newPackageCatalogOption: null });
  };

  return (
    <div className={`nad-svc-card${error ? " has-error" : ""}`}>
      <div className="nad-svc-card__header">
        <span className="nad-svc-card__index">Servizio {index + 1}</span>
        <div className="nad-svc-card__pills">
          <button
            type="button"
            className={`nad-svc-pill${item.type === "catalog" ? " is-active" : ""}`}
            onClick={() => switchType("catalog")}
          >
            Catalogo
          </button>
          <button
            type="button"
            className={`nad-svc-pill${item.type === "custom" ? " is-active" : ""}`}
            onClick={() => switchType("custom")}
          >
            Personalizzato
          </button>
          <button
            type="button"
            className={`nad-svc-pill${item.type === "package" ? " is-active" : ""}`}
            onClick={() => switchType("package")}
          >
            Pacchetto
          </button>
        </div>
        {canRemove && (
          <button
            type="button"
            className="nad-svc-card__remove"
            onClick={onRemove}
            aria-label="Rimuovi servizio"
          >
            ✕
          </button>
        )}
      </div>

      <div className="nad-svc-card__body">
        {/* ── Catalog ─────────────────────────────────────────────── */}
        {item.type === "catalog" && (
          <>
            <input
              type="text"
              className="ag-service-search"
              placeholder="Cerca servizio…"
              value={item.serviceSearch}
              onChange={e => onUpdate({ serviceSearch: e.target.value, serviceId: "", serviceOptionId: null })}
              autoComplete="off"
            />
            {serviceCategories.length > 0 && (
              <div className="ag-service-cats">
                <button
                  type="button"
                  className={`ag-service-cat${item.serviceCatFilter === "all" ? " is-active" : ""}`}
                  onClick={() => onUpdate({ serviceCatFilter: "all" })}
                >
                  Tutti
                </button>
                {serviceCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`ag-service-cat${item.serviceCatFilter === cat ? " is-active" : ""}`}
                    onClick={() => onUpdate({ serviceCatFilter: cat })}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="ag-service-list">
              {filteredServices.length === 0 && (
                <div className="ag-service-empty">Nessun servizio trovato.</div>
              )}
              {filteredServices.map(s => (
                <button
                  key={s.serviceId}
                  type="button"
                  className={`ag-service-item${String(item.serviceId) === String(s.serviceId) ? " is-selected" : ""}`}
                  onClick={() => onUpdate({ serviceId: s.serviceId, serviceSearch: "", serviceOptionId: null })}
                >
                  <span className="ag-service-item__title">{s.title}</span>
                  <span className="ag-service-item__meta">
                    {s.durationMin ? `${s.durationMin} min` : ""}
                    {s.price != null ? ` · €${Number(s.price).toFixed(0)}` : ""}
                  </span>
                </button>
              ))}
            </div>

            {/* Service options (shown when selected service has options) */}
            {serviceOpts.length > 0 && (
              <div className="nad-svc-options">
                <div className="nad-form__label">Seleziona un&apos;opzione</div>
                {serviceOptsGrouped.entries.length > 0 ? (
                  <>
                    {serviceOptsGrouped.entries.map(([cat, catOpts]) => (
                      <div key={cat} className="nad-svc-options__group">
                        <div className="nad-svc-options__group-label">{cat}</div>
                        <div className="ag-service-list">
                          {catOpts.map(o => {
                            const optId = o.optionId ?? o.id;
                            return (
                              <button
                                key={optId}
                                type="button"
                                className={`ag-service-item${String(item.serviceOptionId) === String(optId) ? " is-selected" : ""}`}
                                onClick={() => onUpdate({ serviceOptionId: optId })}
                              >
                                <span className="ag-service-item__title">{o.name}</span>
                                {o.price != null && (
                                  <span className="ag-service-item__meta">€{Number(o.price).toFixed(0)}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {serviceOptsGrouped.ungrouped.length > 0 && (
                      <div className="ag-service-list">
                        {serviceOptsGrouped.ungrouped.map(o => {
                          const optId = o.optionId ?? o.id;
                          return (
                            <button
                              key={optId}
                              type="button"
                              className={`ag-service-item${String(item.serviceOptionId) === String(optId) ? " is-selected" : ""}`}
                              onClick={() => onUpdate({ serviceOptionId: optId })}
                            >
                              <span className="ag-service-item__title">{o.name}</span>
                              {o.price != null && (
                                <span className="ag-service-item__meta">€{Number(o.price).toFixed(0)}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="ag-service-list">
                    {serviceOpts.map(o => {
                      const optId = o.optionId ?? o.id;
                      return (
                        <button
                          key={optId}
                          type="button"
                          className={`ag-service-item${String(item.serviceOptionId) === String(optId) ? " is-selected" : ""}`}
                          onClick={() => onUpdate({ serviceOptionId: optId })}
                        >
                          <span className="ag-service-item__title">{o.name}</span>
                          {o.price != null && (
                            <span className="ag-service-item__meta">€{Number(o.price).toFixed(0)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Custom ──────────────────────────────────────────────── */}
        {item.type === "custom" && (
          <>
            <div className="nad-form__row">
              <label className="nad-form__label">Nome trattamento *</label>
              <input
                type="text"
                className="nad-form__input"
                value={item.customName}
                onChange={e => onUpdate({ customName: e.target.value })}
                placeholder="Es. Ceretta sopracciglia"
                maxLength={255}
              />
            </div>
            <div className="nad-form__row nad-form__row--2col">
              <div>
                <label className="nad-form__label">Durata (min) *</label>
                <input
                  type="number"
                  className="nad-form__input"
                  value={item.customDuration}
                  onChange={e => onUpdate({ customDuration: e.target.value })}
                  min={5}
                  max={480}
                  step={5}
                  placeholder="60"
                />
              </div>
              <div>
                <label className="nad-form__label">Prezzo (€)</label>
                <input
                  type="number"
                  className="nad-form__input"
                  value={item.customPrice}
                  onChange={e => onUpdate({ customPrice: e.target.value })}
                  min={0}
                  step={0.5}
                  placeholder="Opzionale"
                />
              </div>
            </div>
          </>
        )}

        {/* ── Package ─────────────────────────────────────────────── */}
        {item.type === "package" && (
          <div className="nad-pkg-sections">
            {/* Sub-section A: Active client packages */}
            <div>
              <div className="nad-pkg-section-label">Pacchetti attivi del cliente</div>
              {clientPackages.length > 0 ? (
                <div className="nad-pkg-list">
                  {clientPackages.length > 3 && (
                    <input
                      type="text"
                      className="nad-form__input"
                      placeholder="Cerca pacchetto…"
                      value={activePkgSearch}
                      onChange={e => setActivePkgSearch(e.target.value)}
                      style={{ marginBottom: 6 }}
                    />
                  )}
                  {filteredClientPackages.map(pkg => (
                    <div
                      key={pkg.id}
                      className={`nad-pkg-item${String(item.packageAssignmentId) === String(pkg.id) ? " is-selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectPackageAssignment(pkg.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectPackageAssignment(pkg.id);
                        }
                      }}
                    >
                      <div className="nad-pkg-item__main">
                        <span className="nad-pkg-item__name">{pkgDisplayName(pkg)}</span>
                        <span className="nad-pkg-item__sessions">
                          — {pkg.sessionsRemaining} sed. rimanenti
                        </span>
                      </div>
                      <div className="nad-pkg-item__actions">
                        <button
                          type="button"
                          className="nad-pkg-action-btn nad-pkg-edit-btn"
                          aria-label="Modifica pacchetto"
                          onClick={e => {
                            e.stopPropagation();
                            // TODO: open edit modal for package assignment
                            selectPackageAssignment(pkg.id);
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="nad-pkg-action-btn nad-pkg-delete-btn"
                          aria-label="Elimina pacchetto"
                          onClick={e => {
                            e.stopPropagation();
                            if (!window.confirm("Eliminare il pacchetto?")) return;
                            onDeletePackage?.(pkg.id);
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="nad-help">Nessun pacchetto attivo per questa cliente.</div>
              )}
            </div>

            <div className="nad-pkg-separator" />

            {/* Sub-section B: Create new package */}
            <div>
              <div className="nad-pkg-section-label">Crea nuovo pacchetto</div>

              {/* Mode toggle pills — only when catalog packages exist */}
              {catalogPackages.length > 0 && (
                <div className="nad-pkg-mode-toggle">
                  <button
                    type="button"
                    className={`nad-pkg-mode-pill${item.newPkgMode === "catalog" ? " is-active" : ""}`}
                    onClick={() => onUpdate({ newPkgMode: "catalog", newPkgCustomName: "", packageAssignmentId: null })}
                  >
                    Da catalogo
                  </button>
                  <button
                    type="button"
                    className={`nad-pkg-mode-pill${item.newPkgMode === "custom" ? " is-active" : ""}`}
                    onClick={() => onUpdate({ newPkgMode: "custom", newPackageCatalogOption: null, packageAssignmentId: null })}
                  >
                    Personalizzato
                  </button>
                </div>
              )}

              {/* Da catalogo */}
              {catalogPackages.length > 0 && item.newPkgMode === "catalog" && (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    className="nad-form__input"
                    placeholder="Cerca pacchetto…"
                    value={pkgSearch}
                    onChange={e => setPkgSearch(e.target.value)}
                    style={{ marginBottom: 6 }}
                  />
                  <div className="nad-pkg-list">
                    {filteredCatalogPackages.map(opt => (
                      <button
                        key={opt.optionId ?? opt.id}
                        type="button"
                        className={`nad-pkg-item${item.newPackageCatalogOption?.optionId === (opt.optionId ?? opt.id) ? " is-selected" : ""}`}
                        onClick={() => onUpdate({
                          newPackageCatalogOption: { optionId: opt.optionId ?? opt.id, name: opt.optionName },
                          packageAssignmentId: null,
                          newPkgSessions: opt.sessions != null ? String(opt.sessions) : "1",
                          newPkgPrice: opt.price != null ? String(opt.price) : "",
                        })}
                      >
                        <span className="nad-pkg-item__name">{opt.optionName}</span>
                      </button>
                    ))}
                  </div>
                  {item.newPackageCatalogOption && (
                    <div className="nad-form__row nad-form__row--2col" style={{ marginTop: 8 }}>
                      <div>
                        <label className="nad-form__label">
                          Sedute totali *{" "}
                          <span className="nad-help-inline">(dal pacchetto, modificabile)</span>
                        </label>
                        <input
                          type="number"
                          className="nad-form__input"
                          value={item.newPkgSessions}
                          onChange={e => onUpdate({ newPkgSessions: e.target.value })}
                          min={1}
                          max={100}
                          placeholder="es. 10"
                        />
                      </div>
                      <div>
                        <label className="nad-form__label">
                          Prezzo pagato (€){" "}
                          <span className="nad-help-inline">(dal pacchetto, modificabile)</span>
                        </label>
                        <input
                          type="number"
                          className="nad-form__input"
                          value={item.newPkgPrice}
                          onChange={e => onUpdate({ newPkgPrice: e.target.value })}
                          min={0}
                          step={0.5}
                          placeholder="Opzionale"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Personalizzato (shown when mode is "custom" OR no catalog packages exist) */}
              {(item.newPkgMode === "custom" || catalogPackages.length === 0) && (
                <div style={{ marginTop: 8 }}>
                  <div className="nad-form__row" style={{ marginBottom: 8 }}>
                    <label className="nad-form__label">Nome pacchetto *</label>
                    <input
                      type="text"
                      className="nad-form__input"
                      value={item.newPkgCustomName}
                      onChange={e => onUpdate({ newPkgCustomName: e.target.value })}
                      placeholder="Es. Corso laser gambe"
                      maxLength={255}
                    />
                  </div>
                  <div className="nad-form__row nad-form__row--2col">
                    <div>
                      <label className="nad-form__label">Sedute totali *</label>
                      <input
                        type="number"
                        className="nad-form__input"
                        value={item.newPkgSessions}
                        onChange={e => onUpdate({ newPkgSessions: e.target.value })}
                        min={1}
                        max={100}
                        placeholder="es. 10"
                      />
                    </div>
                    <div>
                      <label className="nad-form__label">Prezzo pagato (€)</label>
                      <input
                        type="number"
                        className="nad-form__input"
                        value={item.newPkgPrice}
                        onChange={e => onUpdate({ newPkgPrice: e.target.value })}
                        min={0}
                        step={0.5}
                        placeholder="Opzionale"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="nad-svc-card__footer">
        {durationLabel && <span className="nad-svc-card__duration">{durationLabel}</span>}
        {error && <div className="nad-svc-card__error">{error}</div>}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// AppointmentForm — rendered when activeTab === "appointment"
// Unmounts on tab switch → always starts fresh.
// ══════════════════════════════════════════════════════════════════════════════
function AppointmentForm({ services = [], selectedDate, onSuccess, editBooking = null }) {
  const isEditMode = editBooking != null;

  // ── Client ────────────────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState(() =>
    isEditMode ? (editBooking.customerName || "") : ""
  );
  const [customerPhone, setCustomerPhone] = useState(() =>
    isEditMode ? (editBooking.customerPhone || "") : ""
  );
  const [customerEmail, setCustomerEmail] = useState(() =>
    isEditMode && editBooking.customerEmail && !isWalkInEmail(editBooking.customerEmail)
      ? editBooking.customerEmail : ""
  );
  const [walkIn, setWalkIn] = useState(() =>
    isEditMode ? isWalkInEmail(editBooking.customerEmail) : true
  );

  // ── Packages (fetched after client select, used by ServiceItemCard) ───────
  const [clientPackages, setClientPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [catalogPackages, setCatalogPackages] = useState([]);

  // ── Services (multi-service builder) ──────────────────────────────────────
  const [serviceItems, setServiceItems] = useState(() => {
    if (!isEditMode) return [newServiceItem()];
    if (Array.isArray(editBooking.services) && editBooking.services.length > 0) {
      return editBooking.services.map(s => ({
        ...newServiceItem(),
        type: "catalog",
        serviceId: String(s.serviceId || s.id || ""),
      }));
    }
    if (editBooking.isCustomService && editBooking.customServiceName) {
      return [{
        ...newServiceItem(),
        type: "custom",
        customName: editBooking.customServiceName || "",
        customDuration: String(editBooking.customServiceDurationMinutes || 60),
        customPrice: editBooking.customServicePrice != null ? String(editBooking.customServicePrice) : "",
      }];
    }
    if (editBooking.packageAssignmentId) {
      return [{
        ...newServiceItem(),
        type: "package",
        packageAssignmentId: editBooking.packageAssignmentId,
      }];
    }
    return [newServiceItem()];
  });
  const [itemErrors, setItemErrors] = useState({});

  // ── Sessions (optional) ───────────────────────────────────────────────────
  const [currentSession, setCurrentSession] = useState(() =>
    isEditMode && editBooking.currentSession ? String(editBooking.currentSession) : ""
  );
  const [totalSessions, setTotalSessions] = useState(() =>
    isEditMode && editBooking.totalSessions ? String(editBooking.totalSessions) : ""
  );
  const [sessionsAutoFilled, setSessionsAutoFilled] = useState(false);
  const prevPkgAssignmentId = useRef(null);
  const pkgAutoFilled = useRef(false);

  // ── Date / slots ──────────────────────────────────────────────────────────
  const [appointmentDate, setAppointmentDate] = useState(() =>
    isEditMode && editBooking.startTime
      ? editBooking.startTime.slice(0, 10)
      : (selectedDate || "")
  );
  const [selectedSlot, setSelectedSlot] = useState(() =>
    isEditMode && editBooking.startTime
      ? editBooking.startTime.slice(11, 16)
      : ""
  );
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  // ── Buffer ────────────────────────────────────────────────────────────────
  const [paddingMinutes, setPaddingMinutes] = useState(() =>
    isEditMode ? (editBooking.paddingMinutes ?? 0) : 0
  );

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState(() =>
    isEditMode ? (editBooking.notes || "") : ""
  );

  // ── Submission ────────────────────────────────────────────────────────────
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [errors, setErrors] = useState({});

  // ── Derived ───────────────────────────────────────────────────────────────
  const serviceCategories = useMemo(() => {
    const seen = new Set();
    return (services || []).reduce((acc, s) => {
      const cat = s.category ?? s.categoryName ?? s.categoryLabel ?? null;
      if (cat && !seen.has(cat)) { seen.add(cat); acc.push(cat); }
      return acc;
    }, []);
  }, [services]);

  // Total duration across all service items
  const totalDuration = useMemo(() => {
    return serviceItems.reduce((sum, item) => {
      if (item.type === "catalog") {
        const svc = services.find(s => String(s.serviceId) === String(item.serviceId));
        return sum + (svc?.durationMin ?? 0);
      }
      if (item.type === "custom") {
        return sum + (parseInt(item.customDuration, 10) || 0);
      }
      if (item.type === "package") {
        if (item.packageAssignmentId) {
          const pkg = clientPackages.find(p => String(p.id) === String(item.packageAssignmentId));
          if (pkg?.serviceOptionId) {
            const svc = services.find(s =>
              s.options?.some(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId)),
            );
            if (svc?.durationMin) return sum + svc.durationMin;
          }
          return sum + 60; // fallback
        }
        if (item.newPackageCatalogOption?.optionId) {
          const optId = item.newPackageCatalogOption.optionId;
          for (const svc of services) {
            const opts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
            if (opts.some(o => String(o.optionId ?? o.id) === String(optId))) {
              return sum + (svc.durationMin || 60);
            }
          }
          return sum + 60; // fallback if service not found
        }
        if (item.newPkgMode === "custom" && item.newPkgCustomName?.trim()) {
          return sum + 60; // default for custom packages
        }
        return sum; // nothing selected yet
      }
      return sum;
    }, 0);
  }, [serviceItems, services, clientPackages]);

  const ensureWalkInEmail = useCallback(() => {
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    return `walkin+${stamp}${WALKIN_MARKER}`;
  }, []);

  // ── Package fetch (triggered on client select only) ───────────────────────
  const fetchClientPackages = useCallback(async name => {
    if (!name?.trim()) return;
    setPackagesLoading(true);
    try {
      const pkgs = await getClientPackageAssignmentsByName(name.trim());
      const active = (pkgs || []).filter(p => p.status === "ACTIVE" && p.sessionsRemaining > 0);
      setClientPackages(active);
    } catch (err) {
      console.error("Package fetch failed (non-blocking):", err);
      setClientPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  const handleDeletePackage = async (packageId) => {
    if (!window.confirm("Eliminare il pacchetto? Questa azione non può essere annullata.")) return;
    try {
      await cancelPackageAssignment(packageId);
      setClientPackages(prev => prev.filter(p => String(p.id) !== String(packageId)));
    } catch (err) {
      alert("Errore durante la cancellazione: " + (err.message || "Errore sconosciuto"));
    }
  };

  // Fetch catalogue packages on mount
  useEffect(() => {
    fetchCatalogPackages()
      .then(opts => setCatalogPackages(opts || []))
      .catch(() => setCatalogPackages([]));
  }, []);

  // Pre-fetch client packages in edit mode
  useEffect(() => {
    if (isEditMode && editBooking.customerName) {
      fetchClientPackages(editBooking.customerName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill sedute fields when an active package assignment is selected
  useEffect(() => {
    const pkgItem = serviceItems.find(i => i.type === "package" && i.packageAssignmentId);
    const pkgId = pkgItem?.packageAssignmentId ?? null;

    const pkgIdChanged = pkgId !== prevPkgAssignmentId.current;
    if (pkgIdChanged) {
      prevPkgAssignmentId.current = pkgId;
      pkgAutoFilled.current = false;
    }

    if (!pkgId || pkgAutoFilled.current) {
      if (!pkgId) setSessionsAutoFilled(false);
      return;
    }

    const pkg = clientPackages.find(p => String(p.id) === String(pkgId));
    if (pkg) {
      setCurrentSession(String((pkg.sessionsUsed ?? 0) + 1));
      setTotalSessions(String(pkg.totalSessions ?? ""));
      setSessionsAutoFilled(true);
      pkgAutoFilled.current = true;
    }
  }, [serviceItems, clientPackages]);

  // ── Slot fetch ────────────────────────────────────────────────────────────
  const fetchSlots = useCallback(async (date, duration) => {
    if (!date || !duration || duration < 5) return;
    setSlotsLoading(true);
    setSlotsError("");
    setSelectedSlot("");
    setSlots([]);
    try {
      const times = await getAdminAvailableSlots(date, duration);
      setSlots(Array.isArray(times) ? times : []);
    } catch (err) {
      setSlotsError(err.message || "Impossibile caricare gli slot disponibili.");
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // Auto-fetch slots when date OR total duration changes
  const prevFetchKey = useRef("");
  useEffect(() => {
    if (!appointmentDate) { setSlots([]); setSelectedSlot(""); return; }
    const key = `${appointmentDate}:${totalDuration}`;
    if (key !== prevFetchKey.current) {
      prevFetchKey.current = key;
      fetchSlots(appointmentDate, totalDuration);
    }
  }, [appointmentDate, totalDuration, fetchSlots]);

  // ── Client handlers ───────────────────────────────────────────────────────
  const handleCustomerNameChange = useCallback(text => {
    setCustomerName(text);
    setClientPackages([]);
  }, []);

  const handleCustomerSelect = useCallback(c => {
    setCustomerName(c.fullName);
    setCustomerPhone(prev => c.phone ?? prev);
    if (c.email && !isWalkInEmail(c.email)) {
      setCustomerEmail(c.email);
      setWalkIn(false);
    }
    fetchClientPackages(c.fullName);
  }, [fetchClientPackages]);

  // ── Service item handlers ─────────────────────────────────────────────────
  const addServiceItem = useCallback(() => {
    setServiceItems(prev => [...prev, newServiceItem()]);
  }, []);

  const removeServiceItem = useCallback(id => {
    setServiceItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateServiceItem = useCallback((id, patch) => {
    setServiceItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    const iErrs = {};

    if (!customerName.trim()) errs.customerName = "Nome obbligatorio";
    if (!customerPhone.trim()) errs.customerPhone = "Telefono obbligatorio";
    if (!walkIn && !customerEmail.trim()) errs.customerEmail = "Email obbligatoria";

    serviceItems.forEach(item => {
      if (item.type === "catalog" && !item.serviceId) {
        iErrs[item.id] = "Seleziona un servizio dal catalogo";
      } else if (item.type === "custom") {
        if (!item.customName.trim()) {
          iErrs[item.id] = "Nome trattamento obbligatorio";
        } else {
          const dur = parseInt(item.customDuration, 10);
          if (!dur || dur < 5) iErrs[item.id] = "Durata minima 5 minuti";
        }
      } else if (item.type === "package" && !item.packageAssignmentId) {
        const effectiveMode = catalogPackages.length === 0 ? "custom" : item.newPkgMode;
        if (effectiveMode === "catalog") {
          if (!item.newPackageCatalogOption) {
            iErrs[item.id] = "Seleziona un pacchetto dal catalogo";
          } else {
            const sessions = parseInt(item.newPkgSessions, 10);
            if (!sessions || sessions < 1) iErrs[item.id] = "Inserisci il numero di sedute (min 1)";
          }
        } else {
          if (!item.newPkgCustomName?.trim()) {
            iErrs[item.id] = "Inserisci il nome del pacchetto personalizzato";
          } else {
            const sessions = parseInt(item.newPkgSessions, 10);
            if (!sessions || sessions < 1) iErrs[item.id] = "Inserisci il numero di sedute (min 1)";
          }
        }
      }
    });

    if (!appointmentDate) errs.appointmentDate = "Data obbligatoria";
    if (!selectedSlot) errs.selectedSlot = "Seleziona un orario";

    setErrors(errs);
    setItemErrors(iErrs);
    return Object.keys(errs).length === 0 && Object.keys(iErrs).length === 0;
  }, [customerName, customerPhone, walkIn, customerEmail, serviceItems, appointmentDate, selectedSlot, catalogPackages]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitted(true);
    if (!validate()) return;

    const catalogIds = serviceItems.filter(i => i.type === "catalog").map(i => i.serviceId);
    const customItems = serviceItems.filter(i => i.type === "custom");
    const pkgItem = serviceItems.find(i => i.type === "package");

    setSubmitting(true);
    setSubmitError("");
    try {
      // If a new package needs to be created, do it first
      let resolvedPackageAssignmentId = pkgItem?.packageAssignmentId ?? null;
      if (pkgItem && !pkgItem.packageAssignmentId) {
        const effectiveMode = catalogPackages.length === 0 ? "custom" : pkgItem.newPkgMode;
        if (effectiveMode === "catalog" && pkgItem.newPackageCatalogOption) {
          const assignment = await createPackageAssignment({
            clientName: customerName.trim(),
            serviceOptionId: pkgItem.newPackageCatalogOption.optionId,
            totalSessions: parseInt(pkgItem.newPkgSessions, 10),
            pricePaid: pkgItem.newPkgPrice ? parseFloat(pkgItem.newPkgPrice) : null,
          });
          resolvedPackageAssignmentId = assignment.id;
        } else if (effectiveMode === "custom" && pkgItem.newPkgCustomName?.trim()) {
          const assignment = await createPackageAssignment({
            clientName: customerName.trim(),
            customPackageName: pkgItem.newPkgCustomName.trim(),
            totalSessions: parseInt(pkgItem.newPkgSessions, 10),
            pricePaid: pkgItem.newPkgPrice ? parseFloat(pkgItem.newPkgPrice) : null,
          });
          resolvedPackageAssignmentId = assignment.id;
        }
      }

      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: walkIn ? ensureWalkInEmail() : customerEmail.trim(),
        date: appointmentDate,
        startTime: selectedSlot,
        notes: notes.trim() || null,
        paddingMinutes: paddingMinutes > 0 ? paddingMinutes : null,
        currentSession: currentSession ? parseInt(currentSession, 10) : null,
        totalSessions: totalSessions ? parseInt(totalSessions, 10) : null,
        serviceIds: catalogIds.length > 0 ? catalogIds : [],
        hasCustomService: customItems.length > 0,
        customServiceName: customItems.length > 0
          ? customItems.map(i => i.customName.trim()).join(", ")
          : null,
        customServiceDurationMinutes: customItems.length > 0
          ? customItems.reduce((s, i) => s + (parseInt(i.customDuration, 10) || 0), 0)
          : null,
        customServicePrice: customItems.length > 0 && customItems[0].customPrice
          ? parseFloat(customItems[0].customPrice)
          : null,
        packageAssignmentId: resolvedPackageAssignmentId,
        serviceOptionId: serviceItems.length === 1 && serviceItems[0].type === "catalog" && serviceItems[0].serviceOptionId
          ? serviceItems[0].serviceOptionId
          : null,
      };

      if (isEditMode) {
        await updateBooking(editBooking.bookingId, payload);
        onSuccess("Appuntamento aggiornato");
      } else {
        await createMultiServiceBooking(payload);
        onSuccess("Appuntamento creato");
      }
    } catch (err) {
      setSubmitError(err.message || "Errore durante il salvataggio.");
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="nad-form" noValidate>

      {/* ── Section 1: Cliente ─────────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Cliente</div>

        <div className="nad-form__row nad-form__row--2col">
          <div>
            <label className="nad-form__label">Nome *</label>
            <CustomerAutocomplete
              value={customerName}
              onChange={handleCustomerNameChange}
              onSelect={handleCustomerSelect}
              isInvalid={submitted && !!errors.customerName}
              placeholder="Cerca o inserisci nome…"
            />
            {submitted && errors.customerName && (
              <div className="nad-field-error">{errors.customerName}</div>
            )}
          </div>
          <div>
            <label className="nad-form__label" htmlFor="nad-phone">Telefono *</label>
            <input
              id="nad-phone"
              type="tel"
              className={`nad-form__input${submitted && errors.customerPhone ? " is-invalid" : ""}`}
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="Es. 333…"
            />
            {submitted && errors.customerPhone && (
              <div className="nad-field-error">{errors.customerPhone}</div>
            )}
          </div>
        </div>

        <div className="nad-form__row">
          <div className="nad-walkin-row">
            <label className="nad-form__label">Email {walkIn ? "" : "*"}</label>
            <label className="nad-switch-label">
              <input
                type="checkbox"
                className="nad-switch"
                checked={walkIn}
                onChange={e => setWalkIn(e.target.checked)}
              />
              <span>Walk-in (senza email)</span>
            </label>
          </div>
          <input
            type="email"
            className="nad-form__input"
            disabled={walkIn}
            value={walkIn ? "" : customerEmail}
            onChange={e => setCustomerEmail(e.target.value)}
            placeholder={walkIn ? "Generata automaticamente" : "cliente@email.com"}
          />
          {submitted && errors.customerEmail && (
            <div className="nad-field-error">{errors.customerEmail}</div>
          )}
          {walkIn && (
            <div className="nad-help">Per i walk-in viene generata una email tecnica automaticamente.</div>
          )}
        </div>

        {packagesLoading && <div className="nad-help">Cerco pacchetti attivi…</div>}
      </div>

      {/* ── Section 2: Servizi ─────────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Servizi</div>

        <div className="nad-svc-list">
          {serviceItems.map((item, idx) => (
            <ServiceItemCard
              key={item.id}
              item={item}
              index={idx}
              services={services}
              serviceCategories={serviceCategories}
              clientPackages={clientPackages}
              catalogPackages={catalogPackages}
              onUpdate={patch => updateServiceItem(item.id, patch)}
              onDeletePackage={handleDeletePackage}
              onRemove={() => removeServiceItem(item.id)}
              canRemove={serviceItems.length > 1}
              error={submitted ? itemErrors[item.id] ?? null : null}
            />
          ))}
        </div>

        {serviceItems.length < 6 && (
          <button type="button" className="nad-add-service" onClick={addServiceItem}>
            + Aggiungi servizio
          </button>
        )}

        {totalDuration > 0 && (
          <div className="nad-duration-total">
            Durata totale: <strong>{formatDuration(totalDuration)}</strong>
          </div>
        )}

        {serviceItems.some(i => i.type === "custom") && (
          <div className="nad-help">I servizi personalizzati non sono visibili ai clienti.</div>
        )}
      </div>

      {/* ── Section 3: Sedute ──────────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Numero seduta (opzionale)</div>
        {sessionsAutoFilled && (
          <div className="nad-help nad-sessions-autofilled-note">
            Compilato automaticamente dal pacchetto. Puoi modificarlo.
          </div>
        )}
        <div className="nad-sessions-row">
          <span className="nad-sessions-label">Seduta n°</span>
          <input
            type="number"
            className="nad-form__input nad-sessions-input"
            value={currentSession}
            onChange={e => { setCurrentSession(e.target.value); setSessionsAutoFilled(false); }}
            min={1}
            placeholder="es. 3"
          />
          <span className="nad-sessions-label">di</span>
          <input
            type="number"
            className="nad-form__input nad-sessions-input"
            value={totalSessions}
            onChange={e => { setTotalSessions(e.target.value); setSessionsAutoFilled(false); }}
            min={1}
            placeholder="es. 10"
          />
        </div>
        <div className="nad-help">
          Solo per tenere traccia manuale. Non crea un pacchetto e non decrementa automaticamente. Per gestire le sedute in modo automatico, usa Servizi → Pacchetto.
        </div>
      </div>

      {/* ── Section 4: Data e ora ──────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Data e ora</div>

        <DateTimeField
          label="Data *"
          mode="date"
          value={appointmentDate}
          onChange={v => setAppointmentDate(v)}
          error={submitted && errors.appointmentDate ? errors.appointmentDate : null}
          placeholder="Seleziona data"
        />

        {appointmentDate && (
          <div className="nad-form__row">
            <div className="nad-slots-header">
              <span className="nad-form__label">Orario *</span>
              {totalDuration > 0 && (
                <span className="nad-help-inline">{totalDuration} min</span>
              )}
              <button
                type="button"
                className="nad-slots-refresh"
                onClick={() => fetchSlots(appointmentDate, totalDuration)}
                disabled={slotsLoading}
                title="Aggiorna slot disponibili"
              >
                ↺
              </button>
            </div>

            {slotsLoading && <div className="nad-help">Carico orari disponibili…</div>}
            {slotsError && <div className="nad-form__error">{slotsError}</div>}

            {!slotsLoading && !slotsError && slots.length === 0 && (
              <div className="nad-help">Nessuno slot libero per questa data e durata.</div>
            )}

            {!slotsLoading && slots.length > 0 && (
              <div className="nad-slots-grid">
                {slots.map(slot => (
                  <button
                    key={slot}
                    type="button"
                    className={`nad-slot${selectedSlot === slot ? " is-selected" : ""}`}
                    onClick={() => setSelectedSlot(selectedSlot === slot ? "" : slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}

            {submitted && errors.selectedSlot && (
              <div className="nad-field-error">{errors.selectedSlot}</div>
            )}
          </div>
        )}

        {/* Buffer */}
        <div className="nad-form__row">
          <label className="nad-form__label">Buffer post-trattamento</label>
          <div className="nad-form__chips">
            {PADDING_PRESETS.map(m => (
              <button
                key={m}
                type="button"
                className={`nad-chip${paddingMinutes === m ? " is-active" : ""}`}
                onClick={() => setPaddingMinutes(m)}
              >
                {m === 0 ? "Nessuno" : `+${m}′`}
              </button>
            ))}
          </div>
          {paddingMinutes > 0 && (
            <div className="nad-help">
              Lo slot successivo sarà bloccato per altri {paddingMinutes} min dopo la fine.
            </div>
          )}
        </div>
      </div>

      {/* ── Section 5: Note ────────────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Note</div>
        <textarea
          className="nad-form__textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Preferenze, dettagli, pagato in contanti…"
          maxLength={1000}
        />
      </div>

      {submitError && (
        <div className="nad-form__error" role="alert">{submitError}</div>
      )}

      <div className="nad-form__actions">
        <button
          type="submit"
          className="nad-btn nad-btn--primary"
          disabled={submitting}
        >
          {submitting ? "Salvataggio…" : isEditMode ? "Salva modifiche" : "Crea appuntamento"}
        </button>
      </div>
    </form>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// PersonalForm — rendered when activeTab === "personal"
// ══════════════════════════════════════════════════════════════════════════════
function PersonalForm({ selectedDate, editingPersonal, onPersonalSaved, onClose }) {
  const [title, setTitle]                   = useState("");
  const [apptDate, setApptDate]             = useState("");
  const [startTime, setStartTime]           = useState("");
  const [duration, setDuration]             = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [notes, setNotes]                   = useState("");
  const [saving, setSaving]                 = useState(false);
  const [formErr, setFormErr]               = useState("");

  // Pre-fill on mount / when editingPersonal changes
  useEffect(() => {
    if (editingPersonal) {
      setTitle(editingPersonal.title || "");
      setApptDate(editingPersonal.appointmentDate || selectedDate || "");
      setStartTime((editingPersonal.startTime || "").slice(0, 5));
      const dur = editingPersonal.durationMinutes;
      if (PERSONAL_DURATION_PRESETS.some(p => p.value === dur)) {
        setDuration(dur);
        setCustomDuration("");
      } else {
        setDuration(0);
        setCustomDuration(String(dur ?? ""));
      }
      setNotes(editingPersonal.notes || "");
    } else {
      setTitle("");
      setApptDate(selectedDate || "");
      setStartTime("");
      setDuration(60);
      setCustomDuration("");
      setNotes("");
    }
    setFormErr("");
  }, [editingPersonal, selectedDate]);

  const handleSubmit = async e => {
    e.preventDefault();
    const actualDuration = duration > 0 ? duration : parseInt(customDuration, 10);
    if (!title.trim() || title.trim().length < 2) {
      setFormErr("Descrizione obbligatoria (min 2 caratteri).");
      return;
    }
    if (!apptDate) { setFormErr("Data obbligatoria."); return; }
    if (!startTime) { setFormErr("Ora di inizio obbligatoria."); return; }
    if (!actualDuration || actualDuration < 1) {
      setFormErr("Seleziona o inserisci una durata valida.");
      return;
    }

    setSaving(true);
    setFormErr("");
    try {
      const payload = {
        title: title.trim(),
        appointmentDate: apptDate,
        startTime,
        durationMinutes: actualDuration,
        notes: notes.trim() || null,
      };
      if (editingPersonal?.id) {
        await updatePersonalAppointment(editingPersonal.id, payload);
      } else {
        await createPersonalAppointment(payload);
      }
      onPersonalSaved?.();
      onClose();
    } catch (err) {
      setFormErr(err.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPersonal?.id) return;
    if (!window.confirm("Eliminare questo appuntamento dal calendario?")) return;
    setSaving(true);
    setFormErr("");
    try {
      await deletePersonalAppointment(editingPersonal.id);
      onPersonalSaved?.();
      onClose();
    } catch (err) {
      setFormErr(err.message || "Errore durante l'eliminazione.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="nad-form" noValidate>
      <div className="nad-form__row">
        <label className="nad-form__label" htmlFor="nad-title">Cosa devo fare *</label>
        <input
          id="nad-title"
          type="text"
          className="nad-form__input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Es. Ordine materiali, Pulizie studio…"
          autoComplete="off"
          maxLength={255}
        />
      </div>

      <div className="nad-form__row nad-form__row--2col">
        <div>
          <DateTimeField
            label="Data *"
            mode="date"
            value={apptDate}
            onChange={v => setApptDate(v)}
          />
        </div>
        <div>
          <DateTimeField
            label="Ora inizio *"
            mode="time"
            value={startTime}
            onChange={v => setStartTime(v)}
          />
        </div>
      </div>

      <div className="nad-form__row">
        <label className="nad-form__label">Durata *</label>
        <div className="nad-form__chips">
          {PERSONAL_DURATION_PRESETS.map(p => (
            <button
              key={p.value}
              type="button"
              className={`nad-chip${duration === p.value ? " is-active" : ""}`}
              onClick={() => { setDuration(p.value); setCustomDuration(""); }}
            >
              {p.label}
            </button>
          ))}
          <input
            type="number"
            className="nad-form__input nad-form__input--small"
            placeholder="…′"
            min={5}
            max={480}
            step={5}
            value={duration === 0 ? customDuration : ""}
            onChange={e => { setDuration(0); setCustomDuration(e.target.value); }}
            aria-label="Durata personalizzata in minuti"
          />
        </div>
      </div>

      <div className="nad-form__row">
        <label className="nad-form__label" htmlFor="nad-pers-notes">Note</label>
        <textarea
          id="nad-pers-notes"
          className="nad-form__textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Note opzionali…"
          maxLength={1000}
        />
      </div>

      {formErr && <div className="nad-form__error" role="alert">{formErr}</div>}

      <div className="nad-form__actions">
        {editingPersonal && (
          <button
            type="button"
            className="nad-btn nad-btn--danger"
            onClick={handleDelete}
            disabled={saving}
          >
            Elimina
          </button>
        )}
        <button type="submit" className="nad-btn nad-btn--primary" disabled={saving}>
          {saving ? "…" : editingPersonal ? "Salva modifiche" : "Aggiungi"}
        </button>
      </div>
    </form>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// NewAppointmentDrawer — main shell
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Props:
 *   isOpen            — controls open/close state
 *   onClose           — called when user closes the drawer
 *   selectedDate      — YYYY-MM-DD, pre-fills date fields
 *   services          — array of service objects from AdminAgendaPage
 *   editingPersonal   — personal appointment object to edit (null = create)
 *   onPersonalSaved   — callback after personal appt create/update/delete
 *   onAppointmentSaved(msg) — callback after booking creation
 */
export default function NewAppointmentDrawer({
  isOpen,
  onClose,
  selectedDate,
  services = [],
  editingPersonal = null,
  editBooking = null,
  onPersonalSaved,
  onAppointmentSaved,
}) {
  const [activeTab, setActiveTab] = useState("appointment");

  // Switch to the right tab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(editingPersonal ? "personal" : "appointment");
    }
  }, [isOpen, editingPersonal]);

  // ESC key closes the drawer
  useEffect(() => {
    if (!isOpen) return;
    const handler = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`nad-backdrop${isOpen ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`nad-drawer${isOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={editingPersonal ? "Modifica appuntamento personale" : editBooking ? "Modifica appuntamento" : "Nuovo appuntamento"}
      >
        {/* Header */}
        <div className="nad-header">
          <div className="nad-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "appointment"}
              className={`nad-tab${activeTab === "appointment" ? " is-active" : ""}`}
              onClick={() => setActiveTab("appointment")}
            >
              Appuntamento
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "personal"}
              className={`nad-tab${activeTab === "personal" ? " is-active" : ""}`}
              onClick={() => setActiveTab("personal")}
            >
              Agenda personale
            </button>
          </div>
          <button
            type="button"
            className="nad-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="nad-content" role="tabpanel">
          {activeTab === "appointment" && (
            <AppointmentForm
              key={isOpen ? `open-${editBooking?.bookingId ?? "new"}` : "closed"}
              services={services}
              selectedDate={selectedDate}
              editBooking={editBooking}
              onSuccess={msg => {
                onAppointmentSaved?.(msg);
                onClose();
              }}
            />
          )}

          {activeTab === "personal" && (
            <PersonalForm
              selectedDate={selectedDate}
              editingPersonal={editingPersonal}
              onPersonalSaved={onPersonalSaved}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </>
  );
}
