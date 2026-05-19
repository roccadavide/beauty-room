import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import CustomerAutocomplete from "../../components/admin/CustomerAutocomplete";
import DateTimeField from "../../components/common/DateTimeField";
import TimePicker from "../../components/common/TimePicker";
import formatDuration from "../../utils/formatDuration";
import {
  cancelPackageAssignment,
  createMultiServiceBooking,
  createPackageAssignment,
  createPersonalAppointment,
  deletePersonalAppointment,
  fetchCatalogPackages,
  getAdminAvailableSlots,
  getClientPackageAssignmentsByName,
  getNextAvailableSlot,
  updateBooking,
  updatePersonalAppointment,
} from "../../api/modules/adminAgenda.api";
import { getActivePackages, updateCustomer, deleteCustomer } from "../../api/modules/customer.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import EditPackageModal from "../../components/common/EditPackageModal";
import "./NewAppointmentDrawer.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const pad2 = n => String(n).padStart(2, "0");
const WALKIN_MARKER = "@beautyroom.local";
const isWalkInEmail = e => !e || e.includes(WALKIN_MARKER);
const PADDING_PRESETS = [0, 15, 20, 30, 45];
const PERSONAL_DURATION_PRESETS = [
  { value: 30, label: "30′" },
  { value: 45, label: "45′" },
  { value: 60, label: "1h" },
  { value: 90, label: "1h30′" },
  { value: 120, label: "2h" },
];

// Helper: resolve display name for a package assignment DTO
const pkgDisplayName = pkg => pkg.serviceTitle || pkg.customPackageName || pkg.serviceOptionName || "—";

// Helper: format a next-available slot as Italian locale string
const _WEEKDAYS_IT = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const _MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const formatItalianSlot = (dateStr, timeStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${_WEEKDAYS_IT[dt.getDay()]} ${d} ${_MONTHS_IT[dt.getMonth()]} · ${timeStr}`;
};

// Helper: format a price number as Italian decimal string (e.g. 18.5 → "18,50")
const fmtEur = n => Number(n).toFixed(2).replace(".", ",");


// Factory for a blank service item
const newServiceItem = () => ({
  id: crypto.randomUUID(),
  type: "custom", // "custom" | "package"
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
  newPkgMode: "catalog", // "catalog" | "custom"
  newPkgCustomName: "",
});

// ── EditServizioModal ─────────────────────────────────────────────────────────
function EditServizioModal({ servizio, catalogServices, onSave, onClose }) {
  const originalPrice = useMemo(() => {
    const svc = (catalogServices || []).find(s => String(s.serviceId) === String(servizio.serviceId));
    if (!svc) return null;
    if (servizio.optionId) {
      const opts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
      const opt = opts.find(o => String(o.optionId ?? o.id) === String(servizio.optionId));
      return opt?.price ?? svc.price ?? null;
    }
    return svc.price ?? null;
  }, [servizio, catalogServices]);

  const [durata, setDurata] = useState(servizio.overrideDurationMin ?? servizio.defaultDurationMin);
  const [prezzo, setPrezzo] = useState(servizio.prezzoOverride ?? originalPrice ?? "");

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = () => {
    const durataNum = parseInt(durata, 10);
    if (isNaN(durataNum) || durataNum < 5) return;
    const prezzoNum = prezzo !== "" && prezzo !== null ? parseFloat(prezzo) : null;
    const finalPrezzo = prezzoNum != null && !isNaN(prezzoNum) ? prezzoNum : originalPrice;
    onSave({
      // null means "use default" — never preserve a stale old override
      overrideDurationMin: durataNum !== servizio.defaultDurationMin ? durataNum : null,
      prezzoOverride: finalPrezzo != null && Number(finalPrezzo) !== Number(originalPrice) ? finalPrezzo : null,
    });
  };

  return ReactDOM.createPortal(
    <div className="ag-edit-svc-backdrop" onClick={onClose}>
      <div className="ag-edit-svc-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ag-edit-svc-header">
          <div className="ag-edit-svc-title">Modifica servizio</div>
          <button className="ag-edit-svc-close" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>
        <div className="ag-edit-svc-service-name">{servizio.title}</div>
        <div className="ag-edit-svc-body">
          <label className="ag-edit-svc-label">
            Durata (min)
            <input type="number" className="ag-edit-svc-input" value={durata} min={5} step={5} onChange={e => setDurata(e.target.value)} autoFocus />
            {(servizio.overrideDurationMin ?? servizio.defaultDurationMin) !== servizio.defaultDurationMin && (
              <span className="ag-edit-svc-orig">default: {servizio.defaultDurationMin} min</span>
            )}
          </label>
          <label className="ag-edit-svc-label">
            Prezzo (€)
            <input
              type="number"
              className="ag-edit-svc-input"
              value={prezzo}
              min={0}
              step={0.5}
              placeholder={originalPrice != null ? String(Number(originalPrice).toFixed(2)) : "—"}
              onChange={e => setPrezzo(e.target.value)}
              onBlur={e => {
                if (e.target.value === "") setPrezzo(originalPrice ?? "");
              }}
            />
            {originalPrice != null && <span className="ag-edit-svc-orig">catalogo: €{Number(originalPrice).toFixed(2)}</span>}
          </label>
        </div>
        <div className="ag-edit-svc-footer">
          <button type="button" className="ag-edit-svc-btn ag-edit-svc-btn--ghost" onClick={onClose}>
            Annulla
          </button>
          <button type="button" className="ag-edit-svc-btn ag-edit-svc-btn--save" onClick={handleSave}>
            Salva
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ServiceItemCard — one service in the multi-service builder
// ══════════════════════════════════════════════════════════════════════════════
function ServiceItemCard({ item, index, services, serviceCategories, clientPackages, catalogPackages, onUpdate, onDeletePackage, onRemove, canRemove, error }) {
  const filteredServices = useMemo(() => {
    let list = services || [];
    if (item.serviceCatFilter !== "all") {
      list = list.filter(s => (s.category ?? s.categoryName ?? s.categoryLabel) === item.serviceCatFilter);
    }
    const needle = item.serviceSearch.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        s =>
          s.title?.toLowerCase().includes(needle) ||
          s.durationMin?.toString().includes(needle) ||
          (s.options || s.serviceOptionList || s.serviceOptions || []).some(o => o.name?.toLowerCase().includes(needle)),
      );
    }
    return list;
  }, [services, item.serviceCatFilter, item.serviceSearch]);

  const selectedService = useMemo(() => services.find(s => String(s.serviceId) === String(item.serviceId)), [services, item.serviceId]);

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
      return formatDuration(selectedService.durationMin);
    }
    if (item.type === "custom") {
      const d = parseInt(item.customDuration, 10);
      return d > 0 ? formatDuration(d) : null;
    }
    if (item.type === "package") {
      if (item.packageAssignmentId) {
        const pkg = clientPackages.find(p => String(p.id) === String(item.packageAssignmentId));
        if (pkg?.serviceOptionId) {
          const svc = services.find(s => s.options?.some(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId)));
          if (svc?.durationMin) return formatDuration(svc.durationMin);
        }
      }
      return null;
    }
    return null;
  }, [item, selectedService, clientPackages, services]);

  const [pkgSearch, setPkgSearch] = useState("");
  const filteredCatalogPackages = catalogPackages.filter(opt => (opt.optionName || opt.name || "").toLowerCase().includes(pkgSearch.toLowerCase()));

  const [activePkgSearch, setActivePkgSearch] = useState("");
  const filteredClientPackages = clientPackages.filter(pkg => pkgDisplayName(pkg).toLowerCase().includes(activePkgSearch.toLowerCase()));

  // ── H1: Price calculator ───────────────────────────────────────────────────
  const selectedCatalogOpt = useMemo(
    () => (item.newPackageCatalogOption ? catalogPackages.find(opt => (opt.optionId ?? opt.id) === item.newPackageCatalogOption.optionId) : null),
    [item.newPackageCatalogOption, catalogPackages],
  );

  const pkgPriceCalc = useMemo(() => {
    const sessions = parseInt(item.newPkgSessions, 10);
    const paid = parseFloat(item.newPkgPrice);
    if (!sessions || sessions < 1 || isNaN(paid) || paid <= 0) return null;
    const pricePerSession = paid / sessions;
    const basePrice = selectedCatalogOpt?.price ?? null;
    const baseSessions = selectedCatalogOpt?.sessions ?? sessions;
    const basePPS = basePrice > 0 && baseSessions > 0 ? basePrice / baseSessions : null;
    const savings = basePrice != null && basePrice > paid ? basePrice - paid : null;
    const discountPct = savings != null && basePrice > 0 ? (savings / basePrice) * 100 : null;
    return { pricePerSession, basePPS, savings, discountPct };
  }, [item.newPkgSessions, item.newPkgPrice, selectedCatalogOpt]);

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
          <button type="button" className={`nad-svc-pill${item.type === "custom" ? " is-active" : ""}`} onClick={() => switchType("custom")}>
            Personalizzato
          </button>
          <button type="button" className={`nad-svc-pill${item.type === "package" ? " is-active" : ""}`} onClick={() => switchType("package")}>
            Pacchetto
          </button>
        </div>
        {canRemove && (
          <button type="button" className="nad-svc-card__remove" onClick={onRemove} aria-label="Rimuovi servizio">
            ✕
          </button>
        )}
      </div>

      <div className="nad-svc-card__body">
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
                        <span className="nad-pkg-item__sessions">— {pkg.sessionsRemaining} sed. rimanenti</span>
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
                    {(() => {
                      // Group by serviceName, sort groups A→Z, sort within by sessions asc
                      const groups = {};
                      filteredCatalogPackages.forEach(opt => {
                        const key = opt.serviceName || "Altro";
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(opt);
                      });
                      return Object.entries(groups)
                        .sort(([a], [b]) => a.localeCompare(b, "it"))
                        .map(([groupName, opts]) => (
                          <div key={groupName} className="nad-pkg-group">
                            <div className="nad-pkg-group-header">{groupName}</div>
                            {[...opts]
                              .sort((a, b) => (a.sessions ?? 0) - (b.sessions ?? 0))
                              .map(opt => (
                                <button
                                  key={opt.optionId ?? opt.id}
                                  type="button"
                                  className={`nad-pkg-item${item.newPackageCatalogOption?.optionId === (opt.optionId ?? opt.id) ? " is-selected" : ""}`}
                                  onClick={() =>
                                    onUpdate({
                                      newPackageCatalogOption: { optionId: opt.optionId ?? opt.id, name: opt.optionName },
                                      packageAssignmentId: null,
                                      newPkgSessions: opt.sessions != null ? String(opt.sessions) : "1",
                                      newPkgPrice: opt.price != null ? String(opt.price) : "",
                                    })
                                  }
                                >
                                  <span className="nad-pkg-item__name">{opt.optionName}</span>
                                  {opt.sessions != null && <span className="nad-pkg-item__sessions">{opt.sessions} sed.</span>}
                                </button>
                              ))}
                          </div>
                        ));
                    })()}
                  </div>
                  {item.newPackageCatalogOption && (
                    <div className="nad-form__row nad-form__row--2col" style={{ marginTop: 8 }}>
                      <div>
                        <label className="nad-form__label">
                          Sedute totali * <span className="nad-help-inline">(dal pacchetto, modificabile)</span>
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
                          Prezzo pagato (€) <span className="nad-help-inline">(dal pacchetto, modificabile)</span>
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
                  {item.newPackageCatalogOption && pkgPriceCalc && (
                    <div className="nad-price-calc">
                      {pkgPriceCalc.basePPS != null && <span className="nad-price-calc__ref">Prezzo normale: €{fmtEur(pkgPriceCalc.basePPS)} / sed.</span>}
                      <span className="nad-price-calc__pps">€{fmtEur(pkgPriceCalc.pricePerSession)} / seduta</span>
                      {pkgPriceCalc.savings != null && pkgPriceCalc.savings > 0 && (
                        <span className="nad-price-calc__savings">
                          Risparmio: €{fmtEur(pkgPriceCalc.savings)} · Sconto {pkgPriceCalc.discountPct.toFixed(1)}% ✦
                        </span>
                      )}
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
                  {pkgPriceCalc && (
                    <div className="nad-price-calc">
                      <span className="nad-price-calc__pps">€{fmtEur(pkgPriceCalc.pricePerSession)} / seduta</span>
                    </div>
                  )}
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
  const isDuplicate = editBooking?._duplicate === true;
  const isEditMode = editBooking != null && !isDuplicate;
  // true for both edit and duplicate — used to pre-fill customer/service data
  const hasBookingData = editBooking != null;

  // ── Client ────────────────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState(() => (hasBookingData ? editBooking.customerName || "" : ""));
  const [customerPhone, setCustomerPhone] = useState(() => (hasBookingData ? editBooking.customerPhone || "" : ""));
  const [customerEmail, setCustomerEmail] = useState(() =>
    hasBookingData && editBooking.customerEmail && !isWalkInEmail(editBooking.customerEmail) ? editBooking.customerEmail : "",
  );
  const [walkIn, setWalkIn] = useState(() => (hasBookingData ? isWalkInEmail(editBooking.customerEmail) : true));

  // ── Packages (fetched after client select, used by ServiceItemCard) ───────
  const [clientPackages, setClientPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [catalogPackages, setCatalogPackages] = useState([]);

  // ── Catalog multi-select ──────────────────────────────────────────────────
  const [selectedServices, setSelectedServices] = useState(() => {
    if (!hasBookingData) return [];
    // Case 1: new multi-service array
    // ServiceSummaryDTO now carries per-entry optionId/optionName from booking_services.
    // Fall back to booking-level optionName for legacy single-service bookings (pre-V54).
    if (Array.isArray(editBooking.services) && editBooking.services.length > 0) {
      const isSingle = editBooking.services.length === 1;
      const resolveDuration = (s, optId) => {
        const fromDto = s.durationMinutes ?? s.durationMin ?? s.duration ?? null;
        if (fromDto != null) return fromDto;
        const catalogSvc = services.find(svc => String(svc.serviceId) === String(s.serviceId ?? s.id));
        if (optId && catalogSvc) {
          const allOpts = catalogSvc.options || catalogSvc.serviceOptionList || catalogSvc.serviceOptions || [];
          const catalogOpt = allOpts.find(o => String(o.optionId ?? o.id) === String(optId));
          if (catalogOpt?.durationMin != null) return catalogOpt.durationMin;
        }
        return catalogSvc?.durationMin ?? 30;
      };
      return editBooking.services.map(s => {
        const baseTitle = s.title ?? s.name ?? s.serviceName ?? "";
        const optId = s.optionId ?? (isSingle ? (editBooking.optionId ?? null) : null);
        const optName = s.optionName ?? (isSingle ? (editBooking.optionName ?? null) : null);
        return {
          uid: crypto.randomUUID(),
          serviceId: s.serviceId ?? s.id,
          optionId: optId,
          title: optName ? `${baseTitle} · ${optName}` : baseTitle,
          defaultDurationMin: resolveDuration(s, optId),
          overrideDurationMin: s.overrideDurationMin ?? null,
        };
      });
    }
    // Package-linked bookings with no booking_services extras: do NOT pre-fill
    // selectedServices with the booking's primary service. That service is the
    // package's underlying service, and the package itself (via selectedPackageId)
    // already accounts for its duration. Pre-filling here would double-count.
    if (editBooking.linkedPackage?.packageAssignmentId) {
      return [];
    }
    // Case 2: legacy single serviceId — look up from services catalog for accurate data
    if (editBooking.serviceId) {
      const match = services.find(s => String(s.serviceId) === String(editBooking.serviceId));
      const baseTitle = match?.title ?? editBooking.serviceTitle ?? "";
      const optionName = editBooking.optionName ?? null;
      return [
        {
          uid: crypto.randomUUID(),
          serviceId: match?.serviceId ?? editBooking.serviceId,
          title: optionName ? `${baseTitle} · ${optionName}` : baseTitle,
          defaultDurationMin: editBooking.optionDuration ?? match?.durationMin ?? 30,
          overrideDurationMin: null,
        },
      ];
    }
    return [];
  });
  const [totalDurationOverride, setTotalDurationOverride] = useState(null);
  // Override for the active-package's contributed duration, editable inline via ✏ button
  const [packageDurationOverride, setPackageDurationOverride] = useState(null);
  const [editingPackageDuration, setEditingPackageDuration] = useState(false);
  const [editingTotalDuration, setEditingTotalDuration] = useState(false);
  const [editingServizio, setEditingServizio] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCatFilter, setCatalogCatFilter] = useState("all");
  const [expandedServiceId, setExpandedServiceId] = useState(null);

  // ── Custom & package service items ────────────────────────────────────────
  const [serviceItems, setServiceItems] = useState(() => {
    if (!hasBookingData) return [];
    if (editBooking.isCustomService && editBooking.customServiceName) {
      // customServiceDurationMinutes was added to AdminBookingCardDTO; fall back to
      // durationMinutes (total booking duration) for bookings created before that fix.
      const dur = editBooking.customServiceDurationMinutes ?? editBooking.durationMinutes ?? 60;
      return [
        {
          ...newServiceItem(),
          type: "custom",
          customName: editBooking.customServiceName || "",
          customDuration: String(dur),
          customPrice: editBooking.customServicePrice != null ? String(editBooking.customServicePrice) : "",
        },
      ];
    }
    if (editBooking.packageAssignmentId) {
      return [
        {
          ...newServiceItem(),
          type: "package",
          packageAssignmentId: editBooking.packageAssignmentId,
        },
      ];
    }
    return [];
  });
  const [itemErrors, setItemErrors] = useState({});

  // ── Sessions (optional) ───────────────────────────────────────────────────
  const [currentSession, setCurrentSession] = useState(() => (isEditMode && editBooking.currentSession ? String(editBooking.currentSession) : ""));
  const [totalSessions, setTotalSessions] = useState(() => (isEditMode && editBooking.totalSessions ? String(editBooking.totalSessions) : ""));
  const [sessionsAutoFilled, setSessionsAutoFilled] = useState(false);
  const prevPkgAssignmentId = useRef(null);
  const pkgAutoFilled = useRef(false);

  // ── Date / slots ──────────────────────────────────────────────────────────
  const [appointmentDate, setAppointmentDate] = useState(() => (isEditMode && editBooking.startTime ? editBooking.startTime.slice(0, 10) : selectedDate || ""));
  const [selectedSlot, setSelectedSlot] = useState(() => (isEditMode && editBooking.startTime ? editBooking.startTime.slice(11, 16) : ""));
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [customTime, setCustomTime] = useState(() => (isEditMode && editBooking?.startTime ? editBooking.startTime.slice(11, 16) : ""));

  // ── "Prossimo disponibile" state ──────────────────────────────────────────
  const [nextSlotResult, setNextSlotResult] = useState(null); // { dateStr, timeStr } | { notFound } | { error }
  const [nextSlotLoading, setNextSlotLoading] = useState(false);
  const lastSuggestedSlotRef = useRef(null); // ISO datetime "YYYY-MM-DDTHH:mm:ss" for cycling

  // ── Buffer ────────────────────────────────────────────────────────────────
  const [paddingMinutes, setPaddingMinutes] = useState(() => (isEditMode ? (editBooking.paddingMinutes ?? 0) : 0));

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState(() => (hasBookingData ? editBooking.notes || "" : ""));

  // ── Paid in store ─────────────────────────────────────────────────────────
  const [paidInStore, setPaidInStore] = useState(() => (isEditMode ? (editBooking.paidInStore ?? false) : false));

  // ── Customer inline edit ───────────────────────────────────────────────────
  const [customerId, setCustomerId] = useState(null);
  const [activePackages, setActivePackages] = useState([]);
  // Read packageAssignmentId from linkedPackage where it actually lives in AdminBookingCardDTO.
  // The previous version read editBooking.packageAssignmentId (which doesn't exist on the DTO),
  // causing edit-mode validation and duration calculations to silently ignore the package.
  const [selectedPackageId, setSelectedPackageId] = useState(() => {
    if (!isEditMode || !editBooking?.linkedPackage) return null;
    return editBooking.linkedPackage.packageAssignmentId ?? null;
  });
  const [selectedPackageCreditId, setSelectedPackageCreditId] = useState(() => {
    if (!isEditMode || !editBooking) return null;
    // packageCreditId lives at the top level of AdminBookingCardDTO (for online packages)
    return editBooking.packageCreditId ?? null;
  });
  const [editPackageInfo] = useState(() => (isEditMode && editBooking?.linkedPackage ? editBooking.linkedPackage : null));
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerEditForm, setCustomerEditForm] = useState({ fullName: "", phone: "", email: "" });
  const [customerEditSaving, setCustomerEditSaving] = useState(false);
  const [customerEditMsg, setCustomerEditMsg] = useState("");

  // ── Confirmation dialogs ──────────────────────────────────────────────────
  const [deletePkgConfirmId, setDeletePkgConfirmId] = useState(null);
  const [deleteCustomerConfirm, setDeleteCustomerConfirm] = useState(false);
  const [deleteCustomerLoading, setDeleteCustomerLoading] = useState(false);
  const [deleteCustomerError, setDeleteCustomerError] = useState("");

  // ── Active-package inline edit / delete ───────────────────────────────────
  const [editingActivePkg, setEditingActivePkg] = useState(null);
  const [deleteActivePkgId, setDeleteActivePkgId] = useState(null);
  const [deleteActivePkgName, setDeleteActivePkgName] = useState("");

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
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        acc.push(cat);
      }
      return acc;
    }, []);
  }, [services]);

  // Filtered catalog services for the top-level picker
  const filteredCatalogServices = useMemo(() => {
    let list = services || [];
    if (catalogCatFilter !== "all") {
      list = list.filter(s => (s.category ?? s.categoryName ?? s.categoryLabel) === catalogCatFilter);
    }
    const needle = catalogSearch.trim().toLowerCase();
    if (needle) {
      list = list.filter(s => {
        if (s.title?.toLowerCase().includes(needle)) return true;
        if (s.durationMin?.toString().includes(needle)) return true;
        const opts = s.options || s.serviceOptionList || s.serviceOptions || [];
        return opts.some(o => o.name?.toLowerCase().includes(needle));
      });
    }
    return list;
  }, [services, catalogSearch, catalogCatFilter]);

  // Auto-expand a service when search matches only its option names
  useEffect(() => {
    const needle = catalogSearch.trim().toLowerCase();
    if (!needle) {
      setExpandedServiceId(null);
      return;
    }
    const match = filteredCatalogServices.find(s => {
      if (s.title?.toLowerCase().includes(needle)) return false;
      const opts = s.options || s.serviceOptionList || s.serviceOptions || [];
      return opts.some(o => o.name?.toLowerCase().includes(needle));
    });
    if (match) setExpandedServiceId(match.serviceId);
  }, [catalogSearch, filteredCatalogServices]);

  // Add a catalog service that has a specific option selected.
  // Toggle: if this option is already selected, remove it; otherwise add it.
  const addServiceWithOption = useCallback((service, option) => {
    const optId = option.optionId ?? option.id;
    setSelectedServices(prev => {
      const alreadyIn = prev.some(ss => ss.serviceId === service.serviceId && ss.optionId === optId);
      if (alreadyIn) return prev.filter(ss => !(ss.serviceId === service.serviceId && ss.optionId === optId));
      return [
        ...prev,
        {
          uid: crypto.randomUUID(),
          serviceId: service.serviceId,
          optionId: optId,
          title: `${service.title} · ${option.name}`,
          defaultDurationMin: option.durationMin ?? service.durationMin ?? 30,
          overrideDurationMin: null,
        },
      ];
    });
  }, []);

  // Total duration: catalog sum (with per-item or total override) + custom/package items
  const totalDuration = useMemo(() => {
    const catalogDur = selectedServices.reduce((sum, ss) => sum + (ss.overrideDurationMin ?? ss.defaultDurationMin), 0);
    const itemsDur = serviceItems.reduce((sum, item) => {
      if (item.type === "custom") {
        return sum + (parseInt(item.customDuration, 10) || 0);
      }
      if (item.type === "package") {
        if (item.packageAssignmentId) {
          const pkg = clientPackages.find(p => String(p.id) === String(item.packageAssignmentId));
          if (pkg?.serviceOptionId) {
            const svc = services.find(s => s.options?.some(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId)));
            if (svc?.durationMin) return sum + svc.durationMin;
          }
          return sum + 60;
        }
        if (item.newPackageCatalogOption?.optionId) {
          const optId = item.newPackageCatalogOption.optionId;
          for (const svc of services) {
            const opts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
            if (opts.some(o => String(o.optionId ?? o.id) === String(optId))) {
              return sum + (svc.durationMin || 60);
            }
          }
          return sum + 60;
        }
        if (item.newPkgMode === "custom" && item.newPkgCustomName?.trim()) {
          return sum + 60;
        }
        return sum;
      }
      return sum;
    }, 0);
    let base = catalogDur + itemsDur;

    // Always include the duration of the currently-selected active package,
    // on top of any extras. Prefer option duration > service duration > 60min fallback.
    const activePkgId = selectedPackageId || selectedPackageCreditId;
    if (activePkgId) {
      const pkg = activePackages.find(p => p.id === activePkgId);
      let pkgDuration = null;
      if (pkg?.serviceOptionId) {
        // Find the service that contains this option, then prefer the option's own duration
        const svc = services.find(s =>
          (s.options || s.serviceOptionList || s.serviceOptions || []).some(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId)),
        );
        if (svc) {
          const opts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
          const opt = opts.find(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId));
          pkgDuration = opt?.durationMin ?? svc.durationMin;
        }
      } else if (pkg?.serviceTitle) {
        // Option-less package: match the catalog service by title
        const name = pkg.serviceTitle.trim().toLowerCase();
        const svc = services.find(s => s.title?.trim().toLowerCase() === name);
        pkgDuration = svc?.durationMin;
      }
      const defaultPkgDuration = pkgDuration ?? 60;
      base += packageDurationOverride ?? defaultPkgDuration;
    }
    return totalDurationOverride ?? base;
  }, [
    selectedServices,
    totalDurationOverride,
    serviceItems,
    services,
    clientPackages,
    selectedPackageId,
    selectedPackageCreditId,
    activePackages,
    packageDurationOverride,
  ]);

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

  const handleDeletePackage = packageId => {
    setDeletePkgConfirmId(packageId);
  };

  const executePkgDelete = async () => {
    if (!deletePkgConfirmId) return;
    try {
      await cancelPackageAssignment(deletePkgConfirmId);
      setClientPackages(prev => prev.filter(p => String(p.id) !== String(deletePkgConfirmId)));
    } catch (err) {
      setSubmitError("Errore durante la cancellazione: " + (err.message || "Errore sconosciuto"));
    } finally {
      setDeletePkgConfirmId(null);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerId) return;
    setDeleteCustomerLoading(true);
    setDeleteCustomerError("");
    try {
      await deleteCustomer(customerId);
      setDeleteCustomerConfirm(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setCustomerId(null);
      setClientPackages([]);
      setActivePackages([]);
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      setDeleteCustomerError(
        status === 409
          ? "Impossibile eliminare: la cliente ha appuntamenti attivi o pacchetti. Cancellali prima."
          : err.message || "Errore durante l'eliminazione.",
      );
    } finally {
      setDeleteCustomerLoading(false);
    }
  };

  const handleActivePkgSaved = updated => {
    setActivePackages(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    setEditingActivePkg(null);
  };

  const executeActivePkgDelete = async () => {
    if (!deleteActivePkgId) return;
    try {
      await cancelPackageAssignment(deleteActivePkgId);
      setActivePackages(prev => prev.filter(p => p.id !== deleteActivePkgId));
      if (selectedPackageId === deleteActivePkgId) setSelectedPackageId(null);
      if (selectedPackageCreditId === deleteActivePkgId) setSelectedPackageCreditId(null);
    } catch (err) {
      setSubmitError("Errore durante la cancellazione del pacchetto: " + (err.message || "Errore sconosciuto"));
    } finally {
      setDeleteActivePkgId(null);
      setDeleteActivePkgName("");
    }
  };

  // Fetch catalogue packages on mount
  useEffect(() => {
    fetchCatalogPackages()
      .then(opts => setCatalogPackages(opts || []))
      .catch(() => setCatalogPackages([]));
  }, []);

  // Load active package assignments when customer is identified
  useEffect(() => {
    if (customerId) {
      getActivePackages(customerId)
        .then(pkgs => setActivePackages(pkgs.filter(p => p.status === "ACTIVE")))
        .catch(() => setActivePackages([]));
    } else {
      setActivePackages([]);
      // Don't reset selectedPackageId/CreditId here. In edit mode customerId is null
      // at mount, and resetting would wipe the value initialized from editBooking.linkedPackage.
      // Those two states are reset explicitly by:
      //   - handleCustomerNameChange (admin types a different name)
      //   - handleCustomerSelect      (admin picks a different customer from autocomplete)
    }
  }, [customerId]);

  // Pre-fetch client packages in edit mode or duplicate mode.
  // In edit mode there's no customerId resolved (the customer comes from the
  // booking, not the autocomplete), so the [customerId] effect won't populate
  // activePackages. Do it here directly — without it, the package row in
  // "Servizi selezionati" can't find its data and silently doesn't render.
  useEffect(() => {
    if ((isEditMode || isDuplicate) && editBooking.customerName) {
      (async () => {
        try {
          const pkgs = await getClientPackageAssignmentsByName(editBooking.customerName);
          const active = (pkgs || []).filter(p => p.status === "ACTIVE" && p.sessionsRemaining > 0);
          setClientPackages(active);
          // Shape-compatible with UnifiedActivePackageDTO consumed by the package row.
          // The two DTOs share the relevant fields (id, displayName, serviceTitle,
          // serviceOptionId, totalSessions, sessionsRemaining); we only need to tag the source.
          setActivePackages(active.map(p => ({ ...p, source: "ADMIN" })));
        } catch (err) {
          console.error("Edit-mode package pre-fetch failed (non-blocking):", err);
        }
      })();
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
  const fetchSlots = useCallback(async (date, duration, excludeId = null) => {
    if (!date || !duration || duration < 5) return;
    setSlotsLoading(true);
    setSlotsError("");
    setSlots([]);
    try {
      const times = await getAdminAvailableSlots(date, duration, excludeId);
      setSlots(Array.isArray(times) ? times : []);
    } catch (err) {
      setSlotsError(err.message || "Impossibile caricare gli slot disponibili.");
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // Auto-fetch slots when date OR total duration changes.
  // In edit mode, the initial fetch must NOT clear selectedSlot (it's pre-filled from the booking).
  const prevFetchKey = useRef("");
  useEffect(() => {
    if (!appointmentDate) {
      setSlots([]);
      setSelectedSlot("");
      setCustomTime("");
      return;
    }
    const key = `${appointmentDate}:${totalDuration}`;
    if (key !== prevFetchKey.current) {
      const isInitial = prevFetchKey.current === "";
      prevFetchKey.current = key;
      if (!(isInitial && isEditMode)) {
        setSelectedSlot("");
        setCustomTime("");
      }
      fetchSlots(appointmentDate, totalDuration, isEditMode ? editBooking?.bookingId : null);
    }
  }, [appointmentDate, totalDuration, fetchSlots, isEditMode, editBooking]);

  // ── Client handlers ───────────────────────────────────────────────────────
  const handleCustomerNameChange = useCallback(text => {
    setCustomerName(text);
    setClientPackages([]);
    setActivePackages([]);
    setSelectedPackageId(null);
    setSelectedPackageCreditId(null);
  }, []);

  const handleCustomerSelect = useCallback(
    c => {
      // Different customer (or even same one re-clicked): clear any previously-selected
      // package — it belonged to the prior client. handleCustomerNameChange covers the
      // keystroke-typing path; this handler covers the autocomplete-click path.
      setSelectedPackageId(null);
      setSelectedPackageCreditId(null);
      setPackageDurationOverride(null);
      setEditingPackageDuration(false);

      setCustomerId(c.customerId ?? null);
      setCustomerName(c.fullName);
      setCustomerPhone(prev => c.phone ?? prev);
      if (c.email && !isWalkInEmail(c.email)) {
        setCustomerEmail(c.email);
        setWalkIn(false);
      }
      fetchClientPackages(c.fullName);
      setEditingCustomer(false);
      setCustomerEditMsg("");
    },
    [fetchClientPackages],
  );

  const handleCustomerEditSave = async () => {
    if (!customerId) return;
    setCustomerEditSaving(true);
    setCustomerEditMsg("");
    try {
      const updated = await updateCustomer(customerId, customerEditForm);
      setCustomerName(updated.fullName ?? customerEditForm.fullName);
      if (updated.phone != null) setCustomerPhone(updated.phone);
      setEditingCustomer(false);
      setCustomerEditMsg("Salvato");
    } catch (err) {
      setCustomerEditMsg(err.message || "Errore durante il salvataggio");
    } finally {
      setCustomerEditSaving(false);
    }
  };

  // ── Service item handlers ─────────────────────────────────────────────────
  const addServiceItem = useCallback(() => {
    setServiceItems(prev => [...prev, newServiceItem()]);
  }, []);

  const removeServiceItem = useCallback(id => {
    setServiceItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateServiceItem = useCallback((id, patch) => {
    setServiceItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  // ── "Prossimo disponibile" handler ───────────────────────────────────────
  const handleFindNext = useCallback(async () => {
    if (totalDuration <= 0) return;
    setNextSlotLoading(true);
    try {
      const result = await getNextAvailableSlot(totalDuration, lastSuggestedSlotRef.current);
      if (!result?.found || !result.slot) {
        setNextSlotResult({ notFound: true });
        return;
      }
      const { date, slotStart } = result.slot;
      const time = (slotStart || "").slice(0, 5); // "HH:mm"
      lastSuggestedSlotRef.current = `${date}T${slotStart}`;
      setAppointmentDate(date);
      setCustomTime(time);
      setSelectedSlot("");
      setNextSlotResult({ dateStr: date, timeStr: time });
    } catch (err) {
      setNextSlotResult({ error: err.message || "Errore nella ricerca." });
    } finally {
      setNextSlotLoading(false);
    }
  }, [totalDuration]);

  // ── Derived: effective time (custom input takes priority over slot grid) ──
  const effectiveTime = customTime || selectedSlot;

  const minutesOf = hhmm => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const hasConflict = time => {
    if (!time || slots.length < 2) return false;
    const tMin = minutesOf(time);
    for (let i = 0; i < slots.length - 1; i++) {
      const curr = minutesOf(slots[i]);
      const next = minutesOf(slots[i + 1]);
      // A gap > 30 min between consecutive available slots means something is blocking that window
      if (next - curr > 30 && tMin > curr && tMin < next) return true;
    }
    return false;
  };

  const isOutsideHours = time => {
    if (!time || slots.length === 0) return false;
    const tMin = minutesOf(time);
    return tMin < minutesOf(slots[0]) || tMin > minutesOf(slots[slots.length - 1]);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    const iErrs = {};

    if (!customerName.trim()) errs.customerName = "Nome obbligatorio";
    if (!customerPhone.trim()) errs.customerPhone = "Telefono obbligatorio";
    if (!walkIn && !customerEmail.trim()) errs.customerEmail = "Email obbligatoria";

    const hasService = selectedServices.length > 0 || serviceItems.length > 0 || selectedPackageId != null || selectedPackageCreditId != null;
    if (!hasService) {
      errs.services = "Seleziona almeno un servizio o un pacchetto attivo";
    }

    serviceItems.forEach(item => {
      if (item.type === "custom") {
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
    const resolvedTime = customTime || selectedSlot || (isEditMode ? editBooking?.startTime?.slice(11, 16) : "") || "";
    const timeChanged = resolvedTime !== editBooking?.startTime?.slice(11, 16);
    if (!isEditMode || timeChanged) {
      if (!resolvedTime) errs.selectedSlot = "Seleziona un orario o inserisci un orario personalizzato";
    }

    setErrors(errs);
    setItemErrors(iErrs);
    return Object.keys(errs).length === 0 && Object.keys(iErrs).length === 0;
  }, [
    customerName,
    customerPhone,
    walkIn,
    customerEmail,
    selectedServices,
    serviceItems,
    appointmentDate,
    selectedSlot,
    customTime,
    catalogPackages,
    isEditMode,
    editBooking,
  ]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitted(true);
    if (!validate()) return;

    const catalogIds = selectedServices.map(ss => ss.serviceId);
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

      // Always resolve to "HH:mm" — the backend uses AdminBookingCreateDTO with
      // separate LocalDate date + LocalTime startTime, so we never need a full ISO string.
      const effectiveTime = customTime || selectedSlot || editBooking?.startTime?.slice(11, 16) || "";

      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: walkIn ? ensureWalkInEmail() : customerEmail.trim(),
        date: appointmentDate,
        startTime: effectiveTime,
        notes: notes.trim() || null,
        paddingMinutes: paddingMinutes > 0 ? paddingMinutes : null,
        currentSession: currentSession ? parseInt(currentSession, 10) : null,
        totalSessions: totalSessions ? parseInt(totalSessions, 10) : null,
        serviceIds: catalogIds,
        serviceEntries: selectedServices.map(ss => ({
          serviceId: ss.serviceId,
          optionId: ss.optionId ?? null,
          overrideDurationMin: ss.overrideDurationMin ?? null,
          prezzoOverride: ss.prezzoOverride ?? null,
        })),
        customTotalDurationMin:
          totalDurationOverride ??
          (selectedPackageId != null || selectedPackageCreditId != null || pkgItem != null || selectedServices.some(ss => ss.overrideDurationMin != null)
            ? totalDuration
            : null),
        hasCustomService: customItems.length > 0,
        customServiceName: customItems.length > 0 ? customItems.map(i => i.customName.trim()).join(", ") : null,
        customServiceDurationMinutes: customItems.length > 0 ? customItems.reduce((s, i) => s + (parseInt(i.customDuration, 10) || 0), 0) : null,
        customServicePrice: customItems.length > 0 && customItems[0].customPrice ? parseFloat(customItems[0].customPrice) : null,
        packageAssignmentId: selectedPackageId ?? resolvedPackageAssignmentId,
        packageCreditId: selectedPackageCreditId ?? null,
        serviceOptionId: selectedServices[0]?.optionId ?? null, // backward compat; serviceEntries takes precedence
        paidInStore,
      };

      // TEMP DEBUG — remove after investigation
      console.log(
        "[NAD] PAYLOAD DEBUG",
        JSON.stringify(
          {
            currentSession: payload.currentSession,
            totalSessions: payload.totalSessions,
            packageAssignmentId: payload.packageAssignmentId,
            packageCreditId: payload.packageCreditId,
            serviceIds: payload.serviceIds,
            serviceEntries: payload.serviceEntries,
            customTotalDurationMin: payload.customTotalDurationMin,
            selectedPackageId_state: selectedPackageId,
            selectedPackageCreditId_state: selectedPackageCreditId,
            pkgItem_type: pkgItem?.type,
            pkgItem_packageAssignmentId: pkgItem?.packageAssignmentId,
            resolvedPackageAssignmentId,
            currentSession_state: currentSession,
            totalSessions_state: totalSessions,
          },
          null,
          2,
        ),
      );
      if (isEditMode) {
        await updateBooking(editBooking.bookingId, payload);
        onSuccess("Appuntamento aggiornato");
      } else {
        await createMultiServiceBooking(payload);
        onSuccess(isDuplicate ? "Appuntamento duplicato" : "Appuntamento creato");
      }
    } catch (err) {
      setSubmitError(err.message || "Errore durante il salvataggio.");
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="nad-form" noValidate>
      {isDuplicate && (
        <div className="nad-help" style={{ marginBottom: 12 }}>
          📋 Copia da appuntamento precedente — scegli data e ora
        </div>
      )}

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
            {submitted && errors.customerName && <div className="nad-field-error">{errors.customerName}</div>}
          </div>
          <div>
            <label className="nad-form__label" htmlFor="nad-phone">
              Telefono *
            </label>
            <input
              id="nad-phone"
              type="tel"
              className={`nad-form__input${submitted && errors.customerPhone ? " is-invalid" : ""}`}
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="Es. 333…"
            />
            {submitted && errors.customerPhone && <div className="nad-field-error">{errors.customerPhone}</div>}
          </div>
        </div>

        <div className="nad-form__row">
          <div className="nad-walkin-row">
            <label className="nad-form__label">Email {walkIn ? "" : "*"}</label>
            <label className="nad-switch-label">
              <input type="checkbox" className="nad-switch" checked={walkIn} onChange={e => setWalkIn(e.target.checked)} />
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
          {submitted && errors.customerEmail && <div className="nad-field-error">{errors.customerEmail}</div>}
          {walkIn && <div className="nad-help">Per i walk-in viene generata una email tecnica automaticamente.</div>}
        </div>

        {packagesLoading && <div className="nad-help">Cerco pacchetti attivi…</div>}

        {customerId && !editingCustomer && (
          <div className="ag-customer-action-row">
            <button
              type="button"
              className="ag-customer-edit-btn"
              onClick={() => {
                setCustomerEditForm({ fullName: customerName, phone: customerPhone, email: walkIn ? "" : customerEmail });
                setCustomerEditMsg("");
                setEditingCustomer(true);
              }}
            >
              ✏ Modifica dati cliente
            </button>
            <button
              type="button"
              className="ag-customer-delete-btn"
              onClick={() => {
                setDeleteCustomerError("");
                setDeleteCustomerConfirm(true);
              }}
            >
              🗑 Elimina cliente
            </button>
          </div>
        )}
        {customerEditMsg && !editingCustomer && <div className="nad-help">{customerEditMsg}</div>}
        {deleteCustomerError && !deleteCustomerConfirm && <div className="nad-form__error">{deleteCustomerError}</div>}

        {editingCustomer && (
          <div className="ag-customer-edit-panel">
            <div className="ag-customer-edit-panel__title">Modifica dati cliente</div>
            <div className="ag-customer-edit-panel__fields">
              <div>
                <label className="nad-form__label">Nome</label>
                <input
                  type="text"
                  className="nad-form__input"
                  value={customerEditForm.fullName}
                  onChange={e => setCustomerEditForm(f => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div>
                <label className="nad-form__label">Telefono</label>
                <input
                  type="tel"
                  className="nad-form__input"
                  value={customerEditForm.phone}
                  onChange={e => setCustomerEditForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="nad-form__label">Email</label>
                <input
                  type="email"
                  className="nad-form__input"
                  value={customerEditForm.email}
                  onChange={e => setCustomerEditForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="ag-customer-edit-panel__actions">
              <button type="button" className="nad-btn nad-btn--primary" onClick={handleCustomerEditSave} disabled={customerEditSaving}>
                {customerEditSaving ? "Salvataggio…" : "Salva"}
              </button>
              <button type="button" className="nad-btn" onClick={() => setEditingCustomer(false)} disabled={customerEditSaving}>
                Annulla
              </button>
            </div>
            {customerEditMsg && <div className="nad-form__error">{customerEditMsg}</div>}
          </div>
        )}
      </div>

      {/* ── Active packages — shown after customer select ────────────────── */}
      {(activePackages.length > 0 || editPackageInfo) && (
        <div className="nad-section ag-packages-section">
          <div className="ag-active-pkg-header">
            <span className="ag-active-pkg-header__icon">📦</span>
            <span className="ag-active-pkg-header__label">Pacchetti attivi</span>
          </div>

          {editPackageInfo && (
            <div className="ag-edit-pkg-indicator">
              📦 {editPackageInfo.serviceName || editPackageInfo.packageName || editPackageInfo.serviceTitle || "Pacchetto"} · Seduta{" "}
              {editPackageInfo.sessionNumber ?? "—"} · {editPackageInfo.sessionsRemaining ?? "?"} rimanenti
            </div>
          )}

          {activePackages.length > 0 && (
            <>
              <div className="d-flex flex-wrap gap-2 mt-1">
                {activePackages.map(pkg => {
                  const sessionsUsed = pkg.totalSessions - pkg.sessionsRemaining;
                  const isOnline = pkg.source === "ONLINE";
                  const isSelected = isOnline ? selectedPackageCreditId === pkg.id : selectedPackageId === pkg.id;
                  const handleClick = () => {
                    if (isOnline) {
                      setSelectedPackageCreditId(isSelected ? null : pkg.id);
                      setSelectedPackageId(null);
                    } else {
                      setSelectedPackageId(isSelected ? null : pkg.id);
                      setSelectedPackageCreditId(null);
                    }
                    // When deselecting the package, also clear any duration override on it
                    if (isSelected) {
                      setPackageDurationOverride(null);
                      setEditingPackageDuration(false);
                    }
                    // Note: we no longer wipe selectedServices here — package and extras coexist.
                  };
                  return (
                    <div
                      key={pkg.id}
                      className={`ag-pkg-select-card${isSelected ? " is-selected" : ""}`}
                      onClick={handleClick}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === "Enter" && handleClick()}
                    >
                      <div className="ag-pkg-select-card__body">
                        <div className="ag-pkg-select-card__name">
                          {pkg.displayName || pkg.serviceTitle || "—"}
                          {isOnline && <span className="nad-online-pkg-badge">Online</span>}
                        </div>
                        <div className="ag-pkg-select-card__meta">
                          Seduta {sessionsUsed + 1}/{pkg.totalSessions}
                          {pkg.sessionsRemaining === 1 && <span style={{ color: "#fbbf24" }}> · ultima!</span>}
                        </div>
                      </div>
                      {!isOnline && (
                        <div className="ag-pkg-select-card__actions">
                          <button
                            type="button"
                            className="ag-pkg-action-btn ag-pkg-action-btn--edit"
                            aria-label="Modifica pacchetto"
                            onClick={e => {
                              e.stopPropagation();
                              setEditingActivePkg(pkg);
                            }}
                          >
                            ✏
                          </button>
                          <button
                            type="button"
                            className="ag-pkg-action-btn ag-pkg-action-btn--trash"
                            aria-label="Elimina pacchetto"
                            onClick={e => {
                              e.stopPropagation();
                              setDeleteActivePkgId(pkg.id);
                              setDeleteActivePkgName(pkg.displayName || pkg.serviceTitle || "Pacchetto");
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {(selectedPackageId || selectedPackageCreditId) && (
                <div className="nad-help mt-1">Seduta scalata automaticamente dal pacchetto al salvataggio.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Section 2: Servizi ─────────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Servizi</div>

        {/* ── Catalog picker ────────────────────────────────────────────────── */}
        <input
          type="text"
          className="ag-service-search"
          placeholder="Cerca servizio…"
          value={catalogSearch}
          onChange={e => setCatalogSearch(e.target.value)}
          autoComplete="off"
        />
        {serviceCategories.length > 0 && (
          <div className="ag-service-cats">
            <button type="button" className={`ag-service-cat${catalogCatFilter === "all" ? " is-active" : ""}`} onClick={() => setCatalogCatFilter("all")}>
              Tutti
            </button>
            {serviceCategories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`ag-service-cat${catalogCatFilter === cat ? " is-active" : ""}`}
                onClick={() => setCatalogCatFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        <div className="ag-service-list">
          {filteredCatalogServices.length === 0 && <div className="ag-service-empty">Nessun servizio trovato.</div>}
          {filteredCatalogServices.map(s => {
            const opts = (s.options || s.serviceOptionList || s.serviceOptions || []).filter(o => o.active !== false && (o.sessions ?? 1) <= 1);
            const hasOpts = opts.length > 0;
            const isExpanded = expandedServiceId === s.serviceId;
            const countInSelected = selectedServices.filter(ss => ss.serviceId === s.serviceId).length;

            if (hasOpts) {
              return (
                <div key={s.serviceId} className={`ag-service-item-wrapper${isExpanded ? " is-expanded" : ""}`}>
                  <button
                    type="button"
                    className="ag-service-item ag-service-item--has-options"
                    onClick={() => setExpandedServiceId(isExpanded ? null : s.serviceId)}
                  >
                    <span className="ag-service-item__title">{s.title}</span>
                    <span className="ag-service-item__meta">
                      {countInSelected > 0 && <span className="ag-service-item__selected-count">×{countInSelected}</span>}
                      <span className="ag-service-expand-icon">{isExpanded ? "▾" : "▸"}</span>
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ag-service-options">
                      {opts.map(opt => {
                        const optCount = selectedServices.filter(ss => ss.serviceId === s.serviceId && ss.optionId === (opt.optionId ?? opt.id)).length;
                        return (
                          <button
                            key={opt.optionId ?? opt.id}
                            type="button"
                            className={`ag-service-option-item${optCount > 0 ? " ag-service-option-item--selected" : ""}`}
                            onClick={() => addServiceWithOption(s, opt)}
                          >
                            <span className="ag-service-option-item__name">{opt.name}</span>
                            <span className="ag-service-item__meta">
                              {opt.durationMin ? formatDuration(opt.durationMin) : s.durationMin ? formatDuration(s.durationMin) : ""}
                              {opt.price != null ? ` · €${Number(opt.price).toFixed(0)}` : ""}
                              {optCount > 0 && <span className="ag-option-check"> ×{optCount}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={s.serviceId}
                type="button"
                className={`ag-service-item${countInSelected > 0 ? " ag-service-item--selected" : ""}`}
                onClick={() => {
                  if (countInSelected > 0) {
                    setSelectedServices(prev => prev.filter(ss => ss.serviceId !== s.serviceId));
                  } else {
                    setSelectedServices(prev => [
                      ...prev,
                      {
                        uid: crypto.randomUUID(),
                        serviceId: s.serviceId,
                        title: s.title,
                        defaultDurationMin: s.durationMin ?? 30,
                        overrideDurationMin: null,
                      },
                    ]);
                  }
                }}
              >
                <span className="ag-service-item__title">{s.title}</span>
                <span className="ag-service-item__meta">
                  {s.durationMin ? formatDuration(s.durationMin) : ""}
                  {s.price != null ? ` · €${Number(s.price).toFixed(0)}` : ""}
                </span>
                {countInSelected > 0 && <span className="ag-service-item__selected-count">✓</span>}
              </button>
            );
          })}
        </div>

        {/* ── Selected services panel ───────────────────────────────────────── */}
        {(selectedPackageId || selectedServices.length > 0) && (
          <div className="ag-selected-services">
            <div className="ag-selected-services__label">Servizi selezionati ({(selectedPackageId ? 1 : 0) + selectedServices.length})</div>
            {selectedPackageId &&
              (() => {
                const pkg = activePackages.find(p => p.id === selectedPackageId);
                if (!pkg) return null;
                // Compute the package's default duration the same way totalDuration does
                let defaultDur = null;
                if (pkg.serviceOptionId) {
                  const svc = services.find(s =>
                    (s.options || s.serviceOptionList || s.serviceOptions || []).some(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId)),
                  );
                  if (svc) {
                    const opts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
                    const opt = opts.find(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId));
                    defaultDur = opt?.durationMin ?? svc.durationMin;
                  }
                } else if (pkg.serviceTitle) {
                  const name = pkg.serviceTitle.trim().toLowerCase();
                  const svc = services.find(s => s.title?.trim().toLowerCase() === name);
                  defaultDur = svc?.durationMin;
                }
                defaultDur = defaultDur ?? 60;
                const displayDur = packageDurationOverride ?? defaultDur;
                const sessionNum = isEditMode && editBooking?.currentSession ? editBooking.currentSession : pkg.totalSessions - pkg.sessionsRemaining + 1;
                return (
                  <div
                    className="ag-selected-service-row"
                    style={{ background: "rgba(184, 151, 106, 0.08)", borderLeft: "3px solid var(--card-gold, #b8976a)" }}
                  >
                    <span className="ag-selected-service-row__name">
                      📦 {pkg.displayName || pkg.serviceTitle || "Pacchetto"}
                      <span className="ag-pkg-session-badge" style={{ marginLeft: 8 }}>
                        Seduta {sessionNum}/{pkg.totalSessions}
                      </span>
                    </span>
                    {editingPackageDuration ? (
                      <input
                        type="number"
                        min={5}
                        max={480}
                        step={5}
                        defaultValue={displayDur}
                        autoFocus
                        className="nad-form__input"
                        style={{ width: 70 }}
                        onBlur={e => {
                          const n = parseInt(e.target.value, 10);
                          setPackageDurationOverride(!isNaN(n) && n > 0 && n !== defaultDur ? n : null);
                          setEditingPackageDuration(false);
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setEditingPackageDuration(false);
                        }}
                      />
                    ) : (
                      <span className="ag-selected-service-row__dur">
                        {formatDuration(displayDur)}
                        {packageDurationOverride != null && packageDurationOverride !== defaultDur && (
                          <span className="ag-selected-service-row__orig"> (era {formatDuration(defaultDur)})</span>
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      className="ag-selected-service-row__edit"
                      title="Modifica durata del pacchetto per questo appuntamento"
                      onClick={() => setEditingPackageDuration(true)}
                    >
                      ✏
                    </button>
                    {!isEditMode && (
                      <button
                        type="button"
                        className="ag-selected-service-row__remove"
                        title="Rimuovi pacchetto"
                        onClick={() => {
                          setSelectedPackageId(null);
                          setPackageDurationOverride(null);
                          setEditingPackageDuration(false);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })()}
            {selectedServices.map(ss => (
              <div key={ss.uid} className="ag-selected-service-row">
                <span className="ag-selected-service-row__name">{ss.title}</span>
                <span className="ag-selected-service-row__dur">
                  {formatDuration(ss.overrideDurationMin ?? ss.defaultDurationMin)}
                  {ss.overrideDurationMin !== null && ss.overrideDurationMin !== ss.defaultDurationMin && (
                    <span className="ag-selected-service-row__orig"> (era {formatDuration(ss.defaultDurationMin)})</span>
                  )}
                </span>
                {ss.prezzoOverride != null && (
                  <span className="ag-selected-service-row__price-override">
                    €{Number(ss.prezzoOverride).toFixed(0)} <span className="ag-selected-service-row__price-tag">modificato</span>
                  </span>
                )}
                <button
                  type="button"
                  className="ag-selected-service-row__edit"
                  title="Modifica durata e prezzo per questo appuntamento"
                  onClick={() => setEditingServizio(ss)}
                >
                  ✏
                </button>
                <button
                  type="button"
                  className="ag-selected-service-row__remove"
                  onClick={() => setSelectedServices(prev => prev.filter(s => s.uid !== ss.uid))}
                >
                  ✕
                </button>
              </div>
            ))}
            {(() => {
              const computedTotal = totalDuration;
              const displayTotal = totalDurationOverride ?? computedTotal;
              return (
                <div className="ag-selected-services__total">
                  <span>
                    Durata totale: <b>{formatDuration(displayTotal)}</b>
                  </span>
                  {totalDurationOverride !== null && <span className="ag-selected-services__manual-note"> · modificata manualmente</span>}
                  {!editingTotalDuration ? (
                    <button
                      type="button"
                      className="ag-selected-service-row__edit"
                      title="Sovrascrivi durata totale (es. servizi paralleli)"
                      onClick={() => setEditingTotalDuration(true)}
                    >
                      ✏
                    </button>
                  ) : (
                    <input
                      type="number"
                      min={5}
                      max={480}
                      step={5}
                      defaultValue={displayTotal}
                      autoFocus
                      className="nad-form__input"
                      style={{ width: 70 }}
                      onBlur={e => {
                        const n = parseInt(e.target.value, 10);
                        setTotalDurationOverride(!isNaN(n) && n > 0 ? n : null);
                        setEditingTotalDuration(false);
                      }}
                    />
                  )}
                  {totalDurationOverride !== null && (
                    <button
                      type="button"
                      className="ag-selected-service-row__edit"
                      style={{ fontSize: ".72rem" }}
                      onClick={() => setTotalDurationOverride(null)}
                    >
                      reset
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {submitted && errors.services && <div className="nad-field-error">{errors.services}</div>}

        {/* ── Custom & package items ────────────────────────────────────────── */}
        {serviceItems.length > 0 && (
          <div className="nad-svc-list" style={{ marginTop: 12 }}>
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
                canRemove={true}
                error={submitted ? (itemErrors[item.id] ?? null) : null}
              />
            ))}
          </div>
        )}

        <button type="button" className="nad-add-service" onClick={addServiceItem}>
          + Servizio personalizzato / pacchetto
        </button>

        {totalDuration > 0 && serviceItems.length > 0 && (
          <div className="nad-duration-total">
            Durata totale: <strong>{formatDuration(totalDuration)}</strong>
          </div>
        )}

        {serviceItems.some(i => i.type === "custom") && <div className="nad-help">I servizi personalizzati non sono visibili ai clienti.</div>}
      </div>

      {/* ── Section 3: Sedute ──────────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Numero seduta (opzionale)</div>

        {/* Manual session fields — hidden when a package card is selected */}
        {!selectedPackageId && !selectedPackageCreditId && (
          <>
            {sessionsAutoFilled && <div className="nad-help nad-sessions-autofilled-note">Compilato automaticamente dal pacchetto. Puoi modificarlo.</div>}
            <div className="nad-sessions-row">
              <span className="nad-sessions-label">Seduta n°</span>
              <input
                type="number"
                className="nad-form__input nad-sessions-input"
                value={currentSession}
                onChange={e => {
                  setCurrentSession(e.target.value);
                  setSessionsAutoFilled(false);
                }}
                min={1}
                placeholder="es. 3"
              />
              <span className="nad-sessions-label">di</span>
              <input
                type="number"
                className="nad-form__input nad-sessions-input"
                value={totalSessions}
                onChange={e => {
                  setTotalSessions(e.target.value);
                  setSessionsAutoFilled(false);
                }}
                min={1}
                placeholder="es. 10"
              />
            </div>
            <div className="nad-help">Crea pacchetto con numero di sedute indicate, con scalo automatico sedute e gestione implemetatata nel drawer.</div>
          </>
        )}
      </div>

      {/* ── Section 4: Data e ora ──────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Data e ora</div>

        {/* "Prossimo disponibile" button */}
        <div className="nad-next-slot-row">
          <button
            type="button"
            className="nad-next-slot-btn"
            disabled={totalDuration <= 0 || nextSlotLoading}
            title={totalDuration <= 0 ? "Seleziona prima un trattamento" : undefined}
            onClick={handleFindNext}
          >
            {nextSlotLoading ? "Cerco…" : nextSlotResult?.dateStr ? "Successivo ✦" : "Prossimo disponibile ✦"}
          </button>
          {!nextSlotResult && totalDuration > 0 && (
            <span className="nad-next-slot-hint nad-next-slot-hint--muted">Clicca più volte per altri slot disponibili</span>
          )}
          {nextSlotResult && !nextSlotResult.notFound && !nextSlotResult.error && (
            <span className="nad-next-slot-hint">✦ {formatItalianSlot(nextSlotResult.dateStr, nextSlotResult.timeStr)}</span>
          )}
          {nextSlotResult?.notFound && <span className="nad-next-slot-hint">Nessuna disponibilità trovata nei prossimi 60 giorni.</span>}
          {nextSlotResult?.error && <span className="nad-next-slot-hint nad-next-slot-hint--error">{nextSlotResult.error}</span>}
        </div>

        <DateTimeField
          label="Data *"
          mode="date"
          value={appointmentDate}
          onChange={v => {
            setAppointmentDate(v);
            setNextSlotResult(null);
            lastSuggestedSlotRef.current = null;
          }}
          error={submitted && errors.appointmentDate ? errors.appointmentDate : null}
          placeholder="Seleziona data"
        />

        {appointmentDate && (
          <div className="nad-form__row">
            <div className="nad-slots-header">
              <span className="nad-form__label">Orario *</span>
              {totalDuration > 0 && <span className="nad-help-inline">{totalDuration} min</span>}
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

            {!slotsLoading && !slotsError && slots.length === 0 && <div className="nad-help">Nessuno slot libero per questa data e durata.</div>}

            {!slotsLoading && slots.length > 0 && (
              <div className="nad-slots-grid">
                {slots.map(slot => (
                  <button
                    key={slot}
                    type="button"
                    className={`nad-slot${selectedSlot === slot && !customTime ? " is-selected" : ""}`}
                    onClick={() => {
                      setSelectedSlot(selectedSlot === slot ? "" : slot);
                      setCustomTime("");
                      setNextSlotResult(null);
                      lastSuggestedSlotRef.current = null;
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}

            <div className="ag-custom-time-row">
              <TimePicker
                label="Orario personalizzato"
                value={customTime}
                onChange={v => {
                  setCustomTime(v);
                  setSelectedSlot("");
                  setNextSlotResult(null);
                  lastSuggestedSlotRef.current = null;
                }}
              />
              {customTime && hasConflict(customTime) && <span className="ag-custom-time-warning">⚠ Sovrappone un altro appuntamento</span>}
            </div>

            {effectiveTime && isOutsideHours(effectiveTime) && (
              <div className="ag-custom-time-warning ag-custom-time-warning--outside">⚠ Fuori orario di apertura — puoi procedere</div>
            )}

            {submitted && errors.selectedSlot && <div className="nad-field-error">{errors.selectedSlot}</div>}
          </div>
        )}

        {/* Buffer */}
        <div className="nad-form__row">
          <label className="nad-form__label">Buffer post-trattamento</label>
          <div className="nad-form__chips">
            {PADDING_PRESETS.map(m => (
              <button key={m} type="button" className={`nad-chip${paddingMinutes === m ? " is-active" : ""}`} onClick={() => setPaddingMinutes(m)}>
                {m === 0 ? "Nessuno" : `+${m}′`}
              </button>
            ))}
          </div>
          {paddingMinutes > 0 && <div className="nad-help">Lo slot successivo sarà bloccato per altri {paddingMinutes} min dopo la fine.</div>}
        </div>
      </div>

      {/* ── Section 5: Note ────────────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Note</div>
        <div className="ag-paid-row">
          <label className="ag-paid-toggle">
            <input type="checkbox" checked={paidInStore} onChange={e => setPaidInStore(e.target.checked)} />
            <span className="ag-paid-toggle__label">💵 Già pagato in negozio</span>
          </label>
          {paidInStore && <div className="nad-help">Non conteggiato nell&apos;incasso stimato — incluso nel report mensile.</div>}
        </div>
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
        <div className="nad-form__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="nad-form__actions">
        <button type="submit" className="nad-btn nad-btn--primary" disabled={submitting}>
          {submitting ? "Salvataggio…" : isEditMode ? "Salva modifiche" : "Crea appuntamento"}
        </button>
      </div>

      <ConfirmDialog
        show={!!deletePkgConfirmId}
        onHide={() => setDeletePkgConfirmId(null)}
        onConfirm={executePkgDelete}
        title="Elimina pacchetto"
        message="Sei sicura di voler eliminare questo pacchetto? Questa azione non può essere annullata."
        confirmLabel="Elimina"
        confirmVariant="danger"
      />

      <ConfirmDialog
        show={!!deleteActivePkgId}
        onHide={() => {
          setDeleteActivePkgId(null);
          setDeleteActivePkgName("");
        }}
        onConfirm={executeActivePkgDelete}
        title="Elimina pacchetto"
        message={`Vuoi eliminare il pacchetto "${deleteActivePkgName}"? Le sedute già effettuate rimarranno nello storico.`}
        confirmLabel="Elimina"
        confirmVariant="danger"
      />

      {editingActivePkg && <EditPackageModal pkg={editingActivePkg} services={services} onClose={() => setEditingActivePkg(null)} onSave={handleActivePkgSaved} />}

      {editingServizio && (
        <EditServizioModal
          servizio={editingServizio}
          catalogServices={services}
          onClose={() => setEditingServizio(null)}
          onSave={updates => {
            setSelectedServices(prev => prev.map(s => (s.uid === editingServizio.uid ? { ...s, ...updates } : s)));
            // Clear total override when the effective per-service duration actually changed
            const oldEffective = editingServizio.overrideDurationMin ?? editingServizio.defaultDurationMin;
            const newEffective = updates.overrideDurationMin ?? editingServizio.defaultDurationMin;
            if (newEffective !== oldEffective) setTotalDurationOverride(null);
            setEditingServizio(null);
          }}
        />
      )}

      <ConfirmDialog
        show={deleteCustomerConfirm}
        onHide={() => {
          setDeleteCustomerConfirm(false);
          setDeleteCustomerError("");
        }}
        onConfirm={handleDeleteCustomer}
        title="Elimina cliente"
        message={deleteCustomerError || "Sei sicura di voler eliminare definitivamente questa cliente? Tutti i dati saranno persi."}
        warning={!deleteCustomerError ? "Questa operazione è irreversibile." : undefined}
        confirmLabel={deleteCustomerLoading ? "Eliminazione…" : "Elimina"}
        confirmVariant="danger"
      />
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PersonalForm — rendered when activeTab === "personal"
// ══════════════════════════════════════════════════════════════════════════════
function PersonalForm({ selectedDate, editingPersonal, onPersonalSaved, onClose }) {
  const [title, setTitle] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [deletePersonalConfirm, setDeletePersonalConfirm] = useState(false);

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
    if (!apptDate) {
      setFormErr("Data obbligatoria.");
      return;
    }
    if (!startTime) {
      setFormErr("Ora di inizio obbligatoria.");
      return;
    }
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

  const handleDelete = () => {
    if (!editingPersonal?.id) return;
    setDeletePersonalConfirm(true);
  };

  const executePersonalDelete = async () => {
    setSaving(true);
    setFormErr("");
    setDeletePersonalConfirm(false);
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
        <label className="nad-form__label" htmlFor="nad-title">
          Cosa devo fare *
        </label>
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
          <DateTimeField label="Data *" mode="date" value={apptDate} onChange={v => setApptDate(v)} />
        </div>
        <div>
          <DateTimeField label="Ora inizio *" mode="time" value={startTime} onChange={v => setStartTime(v)} />
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
              onClick={() => {
                setDuration(p.value);
                setCustomDuration("");
              }}
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
            onChange={e => {
              setDuration(0);
              setCustomDuration(e.target.value);
            }}
            aria-label="Durata personalizzata in minuti"
          />
        </div>
      </div>

      <div className="nad-form__row">
        <label className="nad-form__label" htmlFor="nad-pers-notes">
          Note
        </label>
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

      {formErr && (
        <div className="nad-form__error" role="alert">
          {formErr}
        </div>
      )}

      <div className="nad-form__actions">
        {editingPersonal && (
          <button type="button" className="nad-btn nad-btn--danger" onClick={handleDelete} disabled={saving}>
            Elimina
          </button>
        )}
        <button type="submit" className="nad-btn nad-btn--primary" disabled={saving}>
          {saving ? "…" : editingPersonal ? "Salva modifiche" : "Aggiungi"}
        </button>
      </div>

      <ConfirmDialog
        show={deletePersonalConfirm}
        onHide={() => setDeletePersonalConfirm(false)}
        onConfirm={executePersonalDelete}
        title="Elimina appuntamento"
        message="Eliminare questo appuntamento dal calendario? L'azione non può essere annullata."
        confirmLabel="Elimina"
        confirmVariant="danger"
      />
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
    const handler = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    // overflow: hidden rimosso — position: fixed già impedisce lo scroll
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div className={`nad-backdrop${isOpen ? " is-open" : ""}`} onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <div
        className={`nad-drawer${isOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={
          editingPersonal
            ? "Modifica appuntamento personale"
            : editBooking?._duplicate
              ? "Nuovo appuntamento (copia)"
              : editBooking
                ? "Modifica appuntamento"
                : "Nuovo appuntamento"
        }
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
          <button type="button" className="nad-close" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="nad-content" role="tabpanel" onWheel={e => e.stopPropagation()}>
          {activeTab === "appointment" && (
            <AppointmentForm
              key={isOpen ? `open-${editBooking?._duplicate ? `dup-${editBooking?.bookingId}` : (editBooking?.bookingId ?? "new")}` : "closed"}
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
            <PersonalForm selectedDate={selectedDate} editingPersonal={editingPersonal} onPersonalSaved={onPersonalSaved} onClose={onClose} />
          )}
        </div>
      </div>
    </>
  );
}
