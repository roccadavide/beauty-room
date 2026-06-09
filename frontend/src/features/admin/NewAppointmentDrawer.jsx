import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import CustomerAutocomplete from "../../components/admin/CustomerAutocomplete";
import DateTimeField from "../../components/common/DateTimeField";
import DurationField from "../../components/common/DurationField";
import TimePicker from "../../components/common/TimePicker";
import formatDuration from "../../utils/formatDuration";
import { formatEuro } from "../../utils/formatEuro";
import formatPackageItemLabel from "../../utils/formatPackageItemLabel";
import {
  cancelPackageAssignment,
  createMultiServiceBooking,
  createPersonalAppointment,
  deletePersonalAppointment,
  getAdminAvailableSlots,
  getClientPackageAssignmentsByName,
  getNextAvailableSlot,
  updateBooking,
  updatePersonalAppointment,
} from "../../api/modules/adminAgenda.api";
import { createCustomer, getActivePackages, updateCustomer, deleteCustomer } from "../../api/modules/customer.api";
import { fetchActivePromotions } from "../../api/modules/promotions.api";
import { fetchProducts } from "../../api/modules/products.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import EditPackageModal from "../../components/common/EditPackageModal";
import PackagesTab from "../../components/admin/PackagesTab";
import "./NewAppointmentDrawer.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const pad2 = n => String(n).padStart(2, "0");
const WALKIN_MARKER = "@beautyroom.local";
const isWalkInEmail = e => !e || e.includes(WALKIN_MARKER);

const deriveCustomer = b => {
  const has = b != null;
  return {
    customerId: null,
    fullName: has ? b.customerName || "" : "",
    phone: has ? b.customerPhone || "" : "",
    email: has && b.customerEmail && !isWalkInEmail(b.customerEmail) ? b.customerEmail : "",
    walkIn: has ? isWalkInEmail(b.customerEmail) : true,
  };
};

const PADDING_PRESETS = [0, 15, 20, 30, 45];
const PERSONAL_DURATION_PRESETS = [
  { value: 30, label: "30′" },
  { value: 45, label: "45′" },
  { value: 60, label: "1h" },
  { value: 90, label: "1h30′" },
  { value: 120, label: "2h" },
];

// Helper: format a next-available slot as Italian locale string
const _WEEKDAYS_IT = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const _MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const formatItalianSlot = (dateStr, timeStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${_WEEKDAYS_IT[dt.getDay()]} ${d} ${_MONTHS_IT[dt.getMonth()]} · ${timeStr}`;
};

// Promo discount label for the selector cards (mirrors PromoDetailDrawer.getDiscountLabel).
const getPromoDiscountLabel = promo => {
  if (!promo) return null;
  if (promo.discountType === "PERCENTAGE") return `-${Number(promo.discountValue)}%`;
  if (promo.discountType === "FIXED") return `-€${Number(promo.discountValue).toFixed(0)}`;
  return null;
};

// Factory for a blank service item
const newServiceItem = () => ({
  id: crypto.randomUUID(),
  type: "custom",
  customName: "",
  customDuration: "60",
  customPrice: "",
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
          <div className="ag-edit-svc-label">
            <DurationField
              label="Durata"
              value={parseInt(durata, 10) || null}
              onChange={n => setDurata(n != null ? String(n) : "")}
              required
            />
            {(servizio.overrideDurationMin ?? servizio.defaultDurationMin) !== servizio.defaultDurationMin && (
              <span className="ag-edit-svc-orig">default: {servizio.defaultDurationMin} min</span>
            )}
          </div>
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

// Block B: one row in the "Servizi selezionati" panel's 🛍️ Prodotti group.
// unitPrice stays a number in state; this row buffers the price input as a string
// so typing decimals ("12.50") isn't eaten by the number round-trip, committing a
// number on blur/Enter. Quantity stepper is clamped to maxQty by the parent handler.
function SelectedProductRow({ prod, maxQty, isPaidOnline, onQty, onPrice, onPaid, onRemove }) {
  const [priceDraft, setPriceDraft] = useState(String(prod.unitPrice ?? ""));
  useEffect(() => {
    setPriceDraft(String(prod.unitPrice ?? ""));
  }, [prod.unitPrice]);
  const commitPrice = () => {
    const v = parseFloat(priceDraft);
    onPrice(prod.productId, isNaN(v) || v < 0 ? 0 : v);
  };
  const lineTotal = Number(prod.unitPrice || 0) * prod.quantity;
  const settled = isPaidOnline || prod.paid === true;
  const stepBtn = {
    width: 30, height: 30, borderRadius: 8, border: "1px solid var(--card-gold, #b8976a)",
    background: "#fff", color: "var(--card-gold-deep, #8c6d3f)", fontSize: "1.1rem", lineHeight: 1, cursor: "pointer",
  };
  return (
    <div className="ag-selected-service-row" style={{ background: "rgba(184,151,106,0.05)", flexWrap: "wrap" }}>
      <span className="ag-selected-service-row__name">🛍️ {prod.name}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <button type="button" style={stepBtn} onClick={() => onQty(prod.productId, -1)} disabled={prod.quantity <= 1} aria-label="Diminuisci">−</button>
        <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>{prod.quantity}</span>
        <button type="button" style={stepBtn} onClick={() => onQty(prod.productId, 1)} disabled={prod.quantity >= maxQty} aria-label="Aumenta">+</button>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ color: "#8a7a64" }}>€</span>
        <input
          type="number" min={0} step={0.5} value={priceDraft} className="ag-edit-svc-input" style={{ width: 72 }}
          onChange={e => setPriceDraft(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitPrice(); e.currentTarget.blur(); } }}
        />
        <span style={{ fontSize: "0.7rem", color: "#8a7a64" }}>cad.</span>
      </span>
      <span className="ag-selected-service-row__dur" style={{ fontWeight: 600 }}>{formatEuro(lineTotal)}</span>
      {isPaidOnline ? (
        <span className="ag-pill ag-pill--paid" title="Pagato online">✓ Già pagato</span>
      ) : (
        <button
          type="button"
          className={`ag-pill ag-pill--toggle ${settled ? "ag-pill--paid" : "ag-pill--unpaid"}`}
          title={settled ? "Segna come da pagare" : "Segna come pagato"}
          onClick={() => onPaid(prod.productId, !settled)}
        >
          {settled ? "✓ Pagato" : "⏳ Da pagare"}
        </button>
      )}
      <button type="button" className="ag-selected-service-row__remove" title="Rimuovi prodotto" onClick={() => onRemove(prod.productId)}>✕</button>
    </div>
  );
}

// Phase 6d removed the dedicated ServiceItemCard component: custom services are
// now first-class rows in "Servizi selezionati" (added via an inline form
// triggered from "+ Servizio personalizzato"). See AppointmentForm below for
// the new customForm state and the row rendering.

// ══════════════════════════════════════════════════════════════════════════════
// AppointmentForm — rendered when activeTab === "appointment"
// Unmounts on tab switch / close → state is rebuilt from props on remount.
// For a NEW appointment the persistable subset is rehydrated from `initialDraft`
// (an in-memory snapshot held by the shell) and reported back via `onDraftChange`.
// In edit/duplicate mode both props are absent, so the snapshot is never read or
// written — those flows rebuild purely from `editBooking`.
// ══════════════════════════════════════════════════════════════════════════════
function AppointmentForm({ services = [], selectedDate, onSuccess, editBooking = null, customer, onSelectCustomer, onPatchCustomer, initialDraft = null, onDraftChange, onReset }) {
  const isDuplicate = editBooking?._duplicate === true;
  const isEditMode = editBooking != null && !isDuplicate;
  // true for both edit and duplicate — used to pre-fill customer/service data
  const hasBookingData = editBooking != null;

  // ── Client (lifted to NewAppointmentDrawer — destructure-with-alias keeps reads stable) ──
  const { customerId, fullName: customerName, phone: customerPhone, email: customerEmail, walkIn } = customer;

  // ── Catalog multi-select ──────────────────────────────────────────────────
  const [selectedServices, setSelectedServices] = useState(() => {
    if (!hasBookingData) return initialDraft?.selectedServices ?? [];
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
          // V62: hydrate per-line paid from DTO so reopening a paid appointment
          // does NOT silently reset its flags. paidOnline overrides at the UI
          // layer (everything is settled and read-only).
          paid: s.paid === true,
        };
      });
    }
    // Package-linked bookings with no booking_services extras: do NOT pre-fill
    // selectedServices with the booking's primary service. That service is the
    // package's underlying service, and the package itself (via selectedPackageIds)
    // already accounts for its duration. Pre-filling here would double-count.
    const hasAnyLinkedPackage =
      (Array.isArray(editBooking.linkedPackages) && editBooking.linkedPackages.length > 0) ||
      editBooking.linkedPackage?.packageAssignmentId != null;
    if (hasAnyLinkedPackage) {
      return [];
    }
    // Bug D defense: a promo-only booking can carry a dangling primary serviceId
    // (re-derived from a since-removed package by the backend on legacy/pre-fix
    // rows). Mirror the package guard so it is NOT exploded into a phantom row.
    const hasAnyLinkedPromotion = Array.isArray(editBooking.linkedPromotions) && editBooking.linkedPromotions.length > 0;
    if (hasAnyLinkedPromotion) {
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
          paid: false,
        },
      ];
    }
    return [];
  });
  const [totalDurationOverride, setTotalDurationOverride] = useState(() => initialDraft?.totalDurationOverride ?? null);
  // Phase 5b: per-package duration overrides + per-package "editing duration" toggles,
  // keyed by package id. Replaces the singular `packageDurationOverride` /
  // `editingPackageDuration` that assumed a single selected package.
  // (Restore: entries[] → Map. editingDurationPkgIds is transient UI, not persisted.)
  const [packageDurationOverrides, setPackageDurationOverrides] = useState(() => new Map(initialDraft?.packageDurationOverrides ?? []));
  const [editingDurationPkgIds, setEditingDurationPkgIds] = useState(() => new Set());
  const [editingTotalDuration, setEditingTotalDuration] = useState(false);
  // V64 M2a: whole-appointment custom total price override. null = no override
  // (per-line sum wins in the estimato). Prefilled from the booking on edit,
  // or rehydrated from the in-progress draft for a new appointment.
  const [totalPriceOverride, setTotalPriceOverride] = useState(() =>
    editBooking?.customTotalPrice != null ? Number(editBooking.customTotalPrice) : (initialDraft?.totalPriceOverride ?? null),
  );
  const [editingTotalPrice, setEditingTotalPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState(""); // typing buffer (avoids the "80.5" decimal-loss bug)
  const [editingServizio, setEditingServizio] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCatFilter, setCatalogCatFilter] = useState("all");
  const [expandedServiceId, setExpandedServiceId] = useState(null);

  // ── Custom service items ──────────────────────────────────────────────────
  const [serviceItems, setServiceItems] = useState(() => {
    if (!hasBookingData) return initialDraft?.serviceItems ?? [];
    if (editBooking.isCustomService && editBooking.customServiceName) {
      // customServiceDurationMinutes was added to AdminBookingCardDTO; fall back to
      // durationMinutes (total booking duration) for bookings created before that fix.
      const dur = editBooking.customServiceDurationMinutes ?? editBooking.durationMinutes ?? 60;
      return [
        {
          ...newServiceItem(),
          customName: editBooking.customServiceName || "",
          customDuration: String(dur),
          customPrice: editBooking.customServicePrice != null ? String(editBooking.customServicePrice) : "",
        },
      ];
    }
    return [];
  });
  const [itemErrors, setItemErrors] = useState({});

  // ── Date / slots ──────────────────────────────────────────────────────────
  // New appointment: restore the drafted date/time if present, else fall back to
  // the page's selectedDate. Duplicate intentionally starts with a fresh date/time
  // (initialDraft is null in edit/duplicate, so those paths are unchanged).
  const [appointmentDate, setAppointmentDate] = useState(() =>
    isEditMode && editBooking.startTime ? editBooking.startTime.slice(0, 10) : (initialDraft?.appointmentDate ?? selectedDate ?? ""),
  );
  const [selectedSlot, setSelectedSlot] = useState(() =>
    isEditMode && editBooking.startTime ? editBooking.startTime.slice(11, 16) : (initialDraft?.selectedSlot ?? ""),
  );
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [customTime, setCustomTime] = useState(() =>
    isEditMode && editBooking?.startTime ? editBooking.startTime.slice(11, 16) : (initialDraft?.customTime ?? ""),
  );

  // ── "Prossimo disponibile" state ──────────────────────────────────────────
  const [nextSlotResult, setNextSlotResult] = useState(null); // { dateStr, timeStr } | { notFound } | { error }
  const [nextSlotLoading, setNextSlotLoading] = useState(false);
  const lastSuggestedSlotRef = useRef(null); // ISO datetime "YYYY-MM-DDTHH:mm:ss" for cycling

  // ── Buffer ────────────────────────────────────────────────────────────────
  const [paddingMinutes, setPaddingMinutes] = useState(() => (isEditMode ? (editBooking.paddingMinutes ?? 0) : (initialDraft?.paddingMinutes ?? 0)));

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState(() => (hasBookingData ? editBooking.notes || "" : (initialDraft?.notes ?? "")));

  // ── Per-line payment status (V62) ─────────────────────────────────────────
  // Replaces the legacy single paidInStore toggle. State lives on:
  //   • selectedServices[i].paid           — catalog rows (hydrated above)
  //   • packageSessionPaid: Map<pkgId, bool> — in-person package sessions
  //   • customServicePaid: bool             — shared by all serviceItems rows
  //     (the backend folds them into one custom-service line, so they share
  //     a single settled flag)
  // booking.paidOnline (Stripe) forces every line to render as settled and
  // read-only — see isLocked() below.
  const [packageSessionPaid, setPackageSessionPaid] = useState(() => {
    const m = new Map();
    if (!isEditMode || !editBooking) return new Map(initialDraft?.packageSessionPaid ?? []);
    const pkgs = Array.isArray(editBooking.linkedPackages) ? editBooking.linkedPackages : [];
    pkgs.forEach(p => {
      if (p?.packageAssignmentId && !p.paidUpfront) m.set(p.packageAssignmentId, p.paid === true);
    });
    return m;
  });
  const [customServicePaid, setCustomServicePaid] = useState(() => (isEditMode ? editBooking?.customServicePaid === true : (initialDraft?.customServicePaid ?? false)));
  // paidOnline → every line is settled and locked. Read at render time.
  const isPaidOnline = !!editBooking?.paidOnline;

  // ── Customer inline edit ───────────────────────────────────────────────────
  const [activePackages, setActivePackages] = useState([]);
  // Phase 5b: multi-package selection — a Set of in-person ClientPackageAssignment ids.
  // Edit-mode seeds from the new editBooking.linkedPackages[]; falls back to the
  // legacy singular linkedPackage for one release so older backend responses still hydrate.
  const [selectedPackageIds, setSelectedPackageIds] = useState(() => {
    if (!isEditMode || !editBooking) return new Set(initialDraft?.selectedPackageIds ?? []);
    if (Array.isArray(editBooking.linkedPackages) && editBooking.linkedPackages.length > 0) {
      return new Set(editBooking.linkedPackages.map(p => p.packageAssignmentId).filter(Boolean));
    }
    const legacyId = editBooking.linkedPackage?.packageAssignmentId ?? null;
    return legacyId ? new Set([legacyId]) : new Set();
  });
  const [selectedPackageCreditId, setSelectedPackageCreditId] = useState(() => {
    if (!isEditMode || !editBooking) return initialDraft?.selectedPackageCreditId ?? null;
    // packageCreditId lives at the top level of AdminBookingCardDTO (for online packages)
    return editBooking.packageCreditId ?? null;
  });

  // ── Promotions (08.5) ──────────────────────────────────────────────────────
  // Promotions are GLOBAL (not per-customer like packages): fetched once on mount.
  // selectedPromotionIds is a Set of promotionIds; promotionPaid is a
  // Map<promotionId, bool>. Edit mode seeds BOTH from editBooking.linkedPromotions
  // (the frozen snapshot exposed by 08.3). A deleted-promo link has promotionId ==
  // null (frozen history the reconcile never touches) → filtered out so it's NOT re-sent.
  const [activePromotions, setActivePromotions] = useState([]);
  const [selectedPromotionIds, setSelectedPromotionIds] = useState(() => {
    if (!isEditMode || !editBooking) return new Set(initialDraft?.selectedPromotionIds ?? []);
    if (Array.isArray(editBooking.linkedPromotions) && editBooking.linkedPromotions.length > 0) {
      return new Set(editBooking.linkedPromotions.map(p => p.promotionId).filter(Boolean));
    }
    return new Set();
  });
  const [promotionPaid, setPromotionPaid] = useState(() => {
    if (!isEditMode || !editBooking) return new Map(initialDraft?.promotionPaid ?? []);
    const m = new Map();
    (Array.isArray(editBooking.linkedPromotions) ? editBooking.linkedPromotions : []).forEach(p => {
      if (p?.promotionId) m.set(p.promotionId, p.paid === true);
    });
    return m;
  });
  // D2: the promo selector is collapsible — promotions are global and many, and most
  // appointments use none. Collapsed by default; auto-open when a promo is already
  // selected (edit mode) so the current selection stays visible. Transient UI —
  // deliberately NOT persisted in formDraft (like the package expansion toggles).
  const [promosOpen, setPromosOpen] = useState(() => selectedPromotionIds.size > 0);

  // ── Products (Block B / M2) ────────────────────────────────────────────────
  // Products are EXTRAS: they add to the booking total (never duration), are sent
  // as saleEntries on save, and they move stock. selectedProducts is one row per
  // productId; edit/duplicate seed from editBooking.linkedSales (SaleSummaryDTO).
  // The catalog is fetched once on mount.
  const [productCatalog, setProductCatalog] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState(() => {
    if (!hasBookingData) return initialDraft?.selectedProducts ?? [];
    if (Array.isArray(editBooking.linkedSales) && editBooking.linkedSales.length > 0) {
      return editBooking.linkedSales.map(s => ({
        productId: s.productId,
        name: s.productName,
        unitPrice: s.unitPrice != null ? Number(s.unitPrice) : 0,
        quantity: s.quantity ?? 1,
        paid: s.paid === true,
      }));
    }
    return [];
  });

  // ── Products selector (Block B / M2-2) ─────────────────────────────────────
  const [itemMode, setItemMode] = useState("servizi"); // "servizi" | "prodotti" — toggles the input. Transient UI (not persisted).
  const [productSearch, setProductSearch] = useState("");
  // Active products filtered by the search box.
  const filteredProducts = useMemo(() => {
    let list = (productCatalog || []).filter(p => p.active !== false);
    const needle = productSearch.trim().toLowerCase();
    if (needle) list = list.filter(p => p.name?.toLowerCase().includes(needle));
    return list;
  }, [productCatalog, productSearch]);
  // Stock already reflects THIS booking's saved sales. Remaining = stock + qty saved
  // for this booking − qty in the draft, so editing never double-subtracts a saved line.
  const savedSaleQtyByProduct = useMemo(() => {
    const m = new Map();
    if (hasBookingData && Array.isArray(editBooking.linkedSales)) {
      editBooking.linkedSales.forEach(s => m.set(s.productId, (m.get(s.productId) ?? 0) + (s.quantity ?? 0)));
    }
    return m;
  }, [hasBookingData, editBooking]);
  const productRemaining = useCallback(
    p => {
      const saved = savedSaleQtyByProduct.get(p.productId) ?? 0;
      const draft = selectedProducts.find(sp => sp.productId === p.productId)?.quantity ?? 0;
      return Number(p.stock ?? 0) + saved - draft;
    },
    [savedSaleQtyByProduct, selectedProducts],
  );
  // Tap a product → add (qty 1) or increment, clamped to available stock (no oversell).
  const addOrIncProduct = useCallback(
    product => {
      const pid = product.productId;
      const max = Number(product.stock ?? 0) + (savedSaleQtyByProduct.get(pid) ?? 0);
      setSelectedProducts(prev => {
        const idx = prev.findIndex(sp => sp.productId === pid);
        if (idx >= 0) {
          if (prev[idx].quantity >= max) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
        if (max <= 0) return prev;
        return [...prev, { productId: pid, name: product.name, unitPrice: product.price != null ? Number(product.price) : 0, quantity: 1, paid: false }];
      });
    },
    [savedSaleQtyByProduct],
  );
  const changeProductQty = useCallback(
    (productId, delta) => {
      setSelectedProducts(prev =>
        prev.map(sp => {
          if (sp.productId !== productId) return sp;
          const catalog = productCatalog.find(p => p.productId === productId);
          const max = catalog ? Number(catalog.stock ?? 0) + (savedSaleQtyByProduct.get(productId) ?? 0) : sp.quantity;
          return { ...sp, quantity: Math.min(max, Math.max(1, sp.quantity + delta)) };
        }),
      );
    },
    [productCatalog, savedSaleQtyByProduct],
  );
  const setProductUnitPrice = useCallback((productId, value) => {
    setSelectedProducts(prev => prev.map(sp => (sp.productId === productId ? { ...sp, unitPrice: value } : sp)));
  }, []);
  const setProductPaid = useCallback((productId, paid) => {
    setSelectedProducts(prev => prev.map(sp => (sp.productId === productId ? { ...sp, paid } : sp)));
  }, []);
  const removeProduct = useCallback(productId => {
    setSelectedProducts(prev => prev.filter(sp => sp.productId !== productId));
  }, []);
  const productsSubtotal = useMemo(
    () => selectedProducts.reduce((sum, p) => sum + Number(p.unitPrice || 0) * p.quantity, 0),
    [selectedProducts],
  );
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerEditForm, setCustomerEditForm] = useState({ fullName: "", phone: "", email: "" });
  const [customerEditSaving, setCustomerEditSaving] = useState(false);
  const [customerEditMsg, setCustomerEditMsg] = useState("");

  // ── Inline "Salva cliente" (Feature 2) ────────────────────────────────────
  // noCustomerMatch is driven by CustomerAutocomplete's onNoMatch (fail-closed:
  // only true after a search confirms zero DB matches for the typed name).
  // Transient UI — intentionally NOT part of the persisted draft.
  const [noCustomerMatch, setNoCustomerMatch] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [saveCustomerError, setSaveCustomerError] = useState("");

  // ── Confirmation dialogs ──────────────────────────────────────────────────
  const [deleteCustomerConfirm, setDeleteCustomerConfirm] = useState(false);
  const [deleteCustomerLoading, setDeleteCustomerLoading] = useState(false);
  const [deleteCustomerError, setDeleteCustomerError] = useState("");

  // ── Active-package inline edit / delete ───────────────────────────────────
  const [editingActivePkg, setEditingActivePkg] = useState(null);
  const [deleteActivePkgId, setDeleteActivePkgId] = useState(null);
  const [deleteActivePkgName, setDeleteActivePkgName] = useState("");

  // Collapsible per-package state. `expandedPkgIds` covers the "Pacchetti attivi"
  // selection cards. `expandedSelectedPkgIds` covers the "Servizi selezionati" rows
  // (Phase 5b: multiple packages may be selected, each with its own collapsible).
  const [expandedPkgIds, setExpandedPkgIds] = useState(() => new Set());
  const [expandedSelectedPkgIds, setExpandedSelectedPkgIds] = useState(() => new Set());
  const togglePkgExpansion = useCallback(id => {
    setExpandedPkgIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleSelectedPkgExpansion = useCallback(id => {
    setExpandedSelectedPkgIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleEditingDurationPkg = useCallback((id, on) => {
    setEditingDurationPkgIds(prev => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  // Phase 5b: remove a package from selection and drop every per-package satellite
  // collection (duration override, expansion state, editing-duration toggle) for that id.
  const deselectAdminPackage = useCallback(id => {
    setSelectedPackageIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPackageDurationOverrides(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setEditingDurationPkgIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setExpandedSelectedPkgIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Promo selection toggles (08.5). Selecting/deselecting works in both create and
  // edit; deselecting in edit drops the promo from the full set we send, so the
  // backend reconcile detaches it (and restores its product stock).
  const togglePromotion = useCallback(id => {
    setSelectedPromotionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const deselectPromotion = useCallback(id => {
    setSelectedPromotionIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPromotionPaid(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

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

  // Total duration: catalog sum + custom items + every selected in-person package
  // + the (single) online package credit, if any. Per-package fallback chain:
  //   override → pkg.sessionDurationMin → option.durationMin → service.durationMin → 60.
  // sessionDurationMin is the Phase 5b addition (Q10 of the audit): it lets the
  // admin pick a per-package default duration on the package itself, which the
  // booking duration now honors.
  const resolvePkgDuration = useCallback(
    (pkg, overrideMinutes) => {
      if (overrideMinutes != null) return overrideMinutes;
      if (pkg?.sessionDurationMin != null && pkg.sessionDurationMin > 0) return pkg.sessionDurationMin;
      if (pkg?.serviceOptionId) {
        const svc = services.find(s =>
          (s.options || s.serviceOptionList || s.serviceOptions || []).some(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId)),
        );
        if (svc) {
          const opts = svc.options || svc.serviceOptionList || svc.serviceOptions || [];
          const opt = opts.find(o => String(o.optionId ?? o.id) === String(pkg.serviceOptionId));
          const fromOption = opt?.durationMin ?? svc.durationMin;
          if (fromOption) return fromOption;
        }
      } else if (pkg?.serviceTitle) {
        const name = pkg.serviceTitle.trim().toLowerCase();
        const svc = services.find(s => s.title?.trim().toLowerCase() === name);
        if (svc?.durationMin) return svc.durationMin;
      }
      return 60;
    },
    [services],
  );

  // Promo duration: prefer the frozen snapshot (edit mode), else resolve each of
  // the promo's services from the catalog. A deleted/expired promo only exists in
  // the snapshot, so the snapshot branch keeps its row's duration correct.
  const resolvePromoDuration = useCallback(
    promoId => {
      const snap = isEditMode
        ? (editBooking?.linkedPromotions || []).find(p => String(p.promotionId) === String(promoId))
        : null;
      if (snap && Array.isArray(snap.services)) {
        return snap.services.reduce((sum, sv) => sum + (sv.durationMin ?? 0), 0);
      }
      const live = activePromotions.find(p => String(p.promotionId) === String(promoId));
      if (live && Array.isArray(live.serviceIds)) {
        return live.serviceIds.reduce((sum, sid) => {
          const svc = services.find(s => String(s.serviceId) === String(sid));
          return sum + (svc?.durationMin ?? 0);
        }, 0);
      }
      return 0;
    },
    [isEditMode, editBooking, activePromotions, services],
  );

  // Display meta for a selected promo row (title + included service labels).
  const resolvePromoMeta = useCallback(
    promoId => {
      const snap = isEditMode
        ? (editBooking?.linkedPromotions || []).find(p => String(p.promotionId) === String(promoId))
        : null;
      if (snap) {
        return {
          title: snap.title || "Promozione",
          serviceNames: (snap.services || []).map(sv => sv.name).filter(Boolean),
        };
      }
      const live = activePromotions.find(p => String(p.promotionId) === String(promoId));
      if (live) {
        const names = (live.serviceIds || [])
          .map(sid => services.find(s => String(s.serviceId) === String(sid))?.title)
          .filter(Boolean);
        return { title: live.title || "Promozione", serviceNames: names };
      }
      return { title: "Promozione", serviceNames: [] };
    },
    [isEditMode, editBooking, activePromotions, services],
  );

  const totalDuration = useMemo(() => {
    const catalogDur = selectedServices.reduce((sum, ss) => sum + (ss.overrideDurationMin ?? ss.defaultDurationMin), 0);
    const itemsDur = serviceItems.reduce((sum, item) => sum + (parseInt(item.customDuration, 10) || 0), 0);
    let base = catalogDur + itemsDur;

    // Sum every in-person package selected (Phase 5b: multi-select).
    for (const pkgId of selectedPackageIds) {
      const pkg = activePackages.find(p => p.id === pkgId);
      if (!pkg) continue;
      base += resolvePkgDuration(pkg, packageDurationOverrides.get(pkgId));
    }

    // Online package credit (still single, unchanged contract).
    if (selectedPackageCreditId) {
      const pkg = activePackages.find(p => p.id === selectedPackageCreditId);
      if (pkg) base += resolvePkgDuration(pkg, null);
    }

    // Promotions (08.5): add each selected promo's resolved service duration.
    for (const promoId of selectedPromotionIds) {
      base += resolvePromoDuration(promoId);
    }

    return totalDurationOverride ?? base;
  }, [selectedServices, totalDurationOverride, serviceItems, selectedPackageIds, selectedPackageCreditId, activePackages, packageDurationOverrides, resolvePkgDuration, selectedPromotionIds, resolvePromoDuration]);

  const ensureWalkInEmail = useCallback(() => {
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    return `walkin+${stamp}${WALKIN_MARKER}`;
  }, []);

  // Resolve the email to persist for THIS customer. Walk-ins reuse an already
  // generated technical address when present (so inline-create and the booking
  // submit agree on ONE address — never two records with different emails),
  // otherwise generate one once.
  const resolveCustomerEmail = () => {
    if (!walkIn) return customerEmail.trim();
    if (customerEmail && customerEmail.includes(WALKIN_MARKER)) return customerEmail;
    return ensureWalkInEmail();
  };

  // Feature 2: persist a brand-new customer to the DB now, so the Pacchetti tab
  // and the appointment's customerId-gated "Pacchetti attivi" selector can
  // attach/show a package immediately. Reuses the existing lifted-customer path.
  const handleSaveCustomer = async () => {
    setSavingCustomer(true);
    setSaveCustomerError("");
    try {
      const email = resolveCustomerEmail();
      const created = await createCustomer({
        fullName: customerName.trim(),
        phone: customerPhone.trim(),
        email,
      });
      onSelectCustomer({
        customerId: created.customerId,
        fullName: created.fullName,
        phone: created.phone ?? customerPhone.trim(),
        email: created.email ?? email,
      });
      // onSelectCustomer skips walk-in emails (keeps walkIn=true); persist it
      // here so the booking submit reuses this exact address.
      if (walkIn) onPatchCustomer({ email });
      setNoCustomerMatch(false);
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      setSaveCustomerError(
        status === 409
          ? "Telefono o email già associati a un'altra cliente."
          : err.message || "Errore durante il salvataggio della cliente.",
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerId) return;
    setDeleteCustomerLoading(true);
    setDeleteCustomerError("");
    try {
      await deleteCustomer(customerId);
      setDeleteCustomerConfirm(false);
      onPatchCustomer({ customerId: null, fullName: "", phone: "", email: "", walkIn: true });
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
      // Phase 5b: drop the cancelled package from the multi-select set + its
      // per-package satellites. The online branch stays singular.
      if (selectedPackageIds.has(deleteActivePkgId)) deselectAdminPackage(deleteActivePkgId);
      if (selectedPackageCreditId === deleteActivePkgId) setSelectedPackageCreditId(null);
    } catch (err) {
      setSubmitError("Errore durante la cancellazione del pacchetto: " + (err.message || "Errore sconosciuto"));
    } finally {
      setDeleteActivePkgId(null);
      setDeleteActivePkgName("");
    }
  };

  // Load active package assignments when customer is identified.
  // UnifiedActivePackageDTO (from /customers/{id}/active-packages) does NOT carry
  // composition items[] — we fetch ClientPackageAssignmentDTO[] by name in parallel
  // and merge items[] into ADMIN-source rows so the collapsible can render them.
  // The closure captures the customerName valid at customerId-change time; we do
  // not re-fetch on every keystroke.
  useEffect(() => {
    if (customerId) {
      const name = customerName?.trim();
      const adminByNameFetch = name ? getClientPackageAssignmentsByName(name).catch(() => []) : Promise.resolve([]);
      Promise.all([getActivePackages(customerId), adminByNameFetch])
        .then(([unified, admin]) => {
          const adminById = new Map((admin || []).map(p => [String(p.id), p]));
          setActivePackages(
            (unified || [])
              .filter(p => p.status === "ACTIVE")
              .map(p => {
                if (p.source === "ADMIN") {
                  const detail = adminById.get(String(p.id));
                  if (detail?.items) return { ...p, items: detail.items };
                }
                return p;
              }),
          );
        })
        .catch(() => setActivePackages([]));
    } else {
      setActivePackages([]);
      // Don't reset selectedPackageId/CreditId here. In edit mode customerId is null
      // at mount, and resetting would wipe the value initialized from editBooking.linkedPackage.
      // Those two states are reset explicitly by:
      //   - handleCustomerNameChange (admin types a different name)
      //   - handleCustomerSelect      (admin picks a different customer from autocomplete)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Fetch active promotions once on mount. Promotions are global (not tied to the
  // selected customer), so this does not depend on customerId. Only promos that
  // include at least one service are attachable to an appointment — product-only
  // promos go through the Order/product-promo flow, not the agenda.
  useEffect(() => {
    (async () => {
      try {
        const promos = await fetchActivePromotions();
        setActivePromotions((promos || []).filter(p => Array.isArray(p.serviceIds) && p.serviceIds.length > 0));
      } catch (err) {
        console.error("Active promotions fetch failed (non-blocking):", err);
        setActivePromotions([]);
      }
    })();
  }, []);

  // Fetch the product catalog once on mount (Block B). Global like promotions;
  // used by the Prodotti selector (M2-2) and to resolve stock/price.
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchProducts();
        setProductCatalog(Array.isArray(list) ? list : (list?.content ?? []));
      } catch (err) {
        console.error("Product catalog fetch failed (non-blocking):", err);
        setProductCatalog([]);
      }
    })();
  }, []);

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
  // Phase 6d: this effect ONLY fetches — it no longer also clears
  // selectedSlot/customTime. The previous "clear on every key change except
  // the very first" logic dropped the preselected time in edit mode whenever
  // activePackages loaded asynchronously and totalDuration recomputed
  // (because the second-run key change saw isInitial=false and cleared). User
  // actions that genuinely need the time cleared (date change, slot pick,
  // custom time pick) clear it explicitly at the source.
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
      prevFetchKey.current = key;
      fetchSlots(appointmentDate, totalDuration, isEditMode ? editBooking?.bookingId : null);
    }
  }, [appointmentDate, totalDuration, fetchSlots, isEditMode, editBooking]);

  // After slots are (re)fetched, revalidate only selectedSlot — a duration change
  // can leave the previously-picked grid slot no longer in the new window. We do
  // NOT auto-clear customTime here: the slot array can't tell apart a gap caused
  // by an existing booking from a gap caused by a closure window (split-day
  // lunch break, end-of-day, full-day closure), so a heuristic wipe would
  // wrongly reject legal at/near-closing admin bookings. Hard overlaps surface
  // via the soft "⚠ Sovrappone un altro appuntamento" warning under TimePicker
  // and via backend validation on submit; out-of-hours surfaces via the soft
  // "⚠ Fuori orario di apertura — puoi procedere" hint.
  useEffect(() => {
    if (slotsLoading) return;
    if (slots.length === 0) return;
    if (selectedSlot && !slots.includes(selectedSlot)) {
      setSelectedSlot("");
    }
  }, [slots, slotsLoading, selectedSlot]);

  // ── Client handlers ───────────────────────────────────────────────────────
  // Phase 5b: customer-change must clear the multi-select Set and every per-package
  // satellite collection (overrides, expanded set, editing-duration set). The
  // singular online-credit selection is reset as before.
  const resetPackageSelectionState = useCallback(() => {
    setSelectedPackageIds(new Set());
    setPackageDurationOverrides(new Map());
    setEditingDurationPkgIds(new Set());
    setExpandedSelectedPkgIds(new Set());
  }, []);

  const handleCustomerNameChange = useCallback(
    text => {
      onPatchCustomer({ fullName: text });
      setActivePackages([]);
      resetPackageSelectionState();
      setSelectedPackageCreditId(null);
    },
    [onPatchCustomer, resetPackageSelectionState],
  );

  const handleCustomerSelect = useCallback(
    c => {
      // Different customer (or even same one re-clicked): clear any previously-selected
      // package — it belonged to the prior client. handleCustomerNameChange covers the
      // keystroke-typing path; this handler covers the autocomplete-click path.
      resetPackageSelectionState();
      setSelectedPackageCreditId(null);

      onSelectCustomer(c);
      setEditingCustomer(false);
      setCustomerEditMsg("");
    },
    [onSelectCustomer, resetPackageSelectionState],
  );

  const handleCustomerEditSave = async () => {
    if (!customerId) return;
    setCustomerEditSaving(true);
    setCustomerEditMsg("");
    try {
      const updated = await updateCustomer(customerId, customerEditForm);
      onPatchCustomer({
        fullName: updated.fullName ?? customerEditForm.fullName,
        ...(updated.phone != null ? { phone: updated.phone } : {}),
      });
      setEditingCustomer(false);
      setCustomerEditMsg("Salvato");
    } catch (err) {
      setCustomerEditMsg(err.message || "Errore durante il salvataggio");
    } finally {
      setCustomerEditSaving(false);
    }
  };

  // ── Service item handlers ─────────────────────────────────────────────────
  // Phase 6d: custom services are now first-class rows in "Servizi selezionati".
  // The admin opens a small inline form (name + DurationField + price) via the
  // "+ Servizio personalizzato" button, Salva commits it to serviceItems[].
  // Each row can be re-opened in the same form for editing (✏) or removed (✕).
  // Wire payload contract unchanged: N rows are still flattened on submit
  // (join name, sum durations, first price) as the backend expects.
  const blankCustomForm = { active: false, editingId: null, name: "", durationMinutes: 60, price: "" };
  const [customForm, setCustomForm] = useState(blankCustomForm);
  const [customFormError, setCustomFormError] = useState("");

  const openCreateCustomForm = useCallback(() => {
    setCustomForm({ active: true, editingId: null, name: "", durationMinutes: 60, price: "" });
    setCustomFormError("");
  }, []);

  const openEditCustomForm = useCallback(item => {
    setCustomForm({
      active: true,
      editingId: item.id,
      name: item.customName ?? "",
      durationMinutes: parseInt(item.customDuration, 10) || null,
      price: item.customPrice ?? "",
    });
    setCustomFormError("");
  }, []);

  const cancelCustomForm = useCallback(() => {
    setCustomForm(prev => ({ ...prev, active: false }));
    setCustomFormError("");
  }, []);

  const submitCustomForm = useCallback(() => {
    const name = customForm.name.trim();
    const dur = customForm.durationMinutes;
    if (!name) {
      setCustomFormError("Nome trattamento obbligatorio.");
      return;
    }
    if (!dur || dur < 5) {
      setCustomFormError("Durata minima 5 minuti.");
      return;
    }
    if (customForm.price !== "" && Number(customForm.price) < 0) {
      setCustomFormError("Prezzo non può essere negativo.");
      return;
    }
    if (customForm.editingId) {
      setServiceItems(prev =>
        prev.map(it =>
          it.id === customForm.editingId
            ? { ...it, customName: name, customDuration: String(dur), customPrice: customForm.price }
            : it,
        ),
      );
    } else {
      setServiceItems(prev => [
        ...prev,
        { ...newServiceItem(), customName: name, customDuration: String(dur), customPrice: customForm.price },
      ]);
    }
    setCustomForm(blankCustomForm);
    setCustomFormError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customForm]);

  const removeServiceItem = useCallback(id => {
    setServiceItems(prev => prev.filter(item => item.id !== id));
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
      const { date, slotStart, slotEnd } = result.slot;
      const time = (slotStart || "").slice(0, 5); // "HH:mm"
      // Phase 6a fix: cycle by slot END, not start. Storing slotStart caused the
      // backend to return the SAME slot on the next "Successivo ✦" click (the
      // request asks for slots starting at-or-after `after`, and the just-shown
      // slot starts exactly at slotStart). Mirrors AdminAgendaPage.searchNextSlotAgain.
      lastSuggestedSlotRef.current = slotEnd ? `${date}T${slotEnd.slice(0, 5)}:00` : `${date}T${slotStart}`;
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

    const hasService =
      selectedServices.length > 0 ||
      serviceItems.length > 0 ||
      selectedPackageIds.size > 0 ||
      selectedPackageCreditId != null ||
      selectedPromotionIds.size > 0;
    if (!hasService) {
      errs.services = "Seleziona almeno un servizio, un pacchetto o una promozione";
    }

    serviceItems.forEach(item => {
      if (!item.customName.trim()) {
        iErrs[item.id] = "Nome trattamento obbligatorio";
      } else {
        const dur = parseInt(item.customDuration, 10);
        if (!dur || dur < 5) iErrs[item.id] = "Durata minima 5 minuti";
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
    selectedPackageIds,
    selectedPackageCreditId,
    selectedPromotionIds,
    appointmentDate,
    selectedSlot,
    customTime,
    isEditMode,
    editBooking,
  ]);

  // ── Draft persistence (Feature 1) ─────────────────────────────────────────
  // Serialize ONLY the persistable subset (Set/Map → arrays/entries). Transient
  // UI — search/filter/expansion toggles, inline-edit toggles, slot results,
  // validation errors — is intentionally excluded and rebuilt fresh on remount.
  // A half-typed custom-service row (customForm, not yet committed to
  // serviceItems) is deliberately NOT persisted.
  const formDraft = useMemo(
    () => ({
      selectedServices,
      serviceItems,
      selectedPackageIds: Array.from(selectedPackageIds),
      packageDurationOverrides: Array.from(packageDurationOverrides.entries()),
      selectedPackageCreditId,
      packageSessionPaid: Array.from(packageSessionPaid.entries()),
      customServicePaid,
      totalDurationOverride,
      totalPriceOverride,
      appointmentDate,
      selectedSlot,
      customTime,
      paddingMinutes,
      notes,
      selectedPromotionIds: Array.from(selectedPromotionIds),
      promotionPaid: Array.from(promotionPaid.entries()),
      selectedProducts,
    }),
    [selectedServices, serviceItems, selectedPackageIds, packageDurationOverrides, selectedPackageCreditId, packageSessionPaid, customServicePaid, totalDurationOverride, totalPriceOverride, appointmentDate, selectedSlot, customTime, paddingMinutes, notes, selectedPromotionIds, promotionPaid, selectedProducts],
  );
  // Latest snapshot in a ref so the unmount flush captures the final edit even if
  // a passive effect hasn't run yet (fast tab-switch). onDraftChange is undefined
  // in edit/duplicate, so both effects no-op there — the snapshot stays untouched.
  const formDraftRef = useRef(formDraft);
  formDraftRef.current = formDraft;
  useEffect(() => {
    onDraftChange?.(formDraft);
  }, [formDraft, onDraftChange]);
  useEffect(() => () => onDraftChange?.(formDraftRef.current), [onDraftChange]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitted(true);
    if (!validate()) return;

    const catalogIds = selectedServices.map(ss => ss.serviceId);
    const customItems = serviceItems;

    setSubmitting(true);
    setSubmitError("");
    try {
      // Always resolve to "HH:mm" — the backend uses AdminBookingCreateDTO with
      // separate LocalDate date + LocalTime startTime, so we never need a full ISO string.
      const effectiveTime = customTime || selectedSlot || editBooking?.startTime?.slice(11, 16) || "";

      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        // Reuse the inline-created walk-in address when present (resolveCustomerEmail),
        // so create-time and submit-time emails match.
        customerEmail: resolveCustomerEmail(),
        // Step 7: when the customer was created/selected inline, attach the booking
        // to that exact record (backend prefers customerId over find-or-create).
        customerId: customerId ?? null,
        date: appointmentDate,
        startTime: effectiveTime,
        notes: notes.trim() || null,
        paddingMinutes: paddingMinutes > 0 ? paddingMinutes : null,
        currentSession: isEditMode ? (editBooking.currentSession ?? null) : null,
        totalSessions: isEditMode ? (editBooking.totalSessions ?? null) : null,
        serviceIds: catalogIds,
        serviceEntries: selectedServices.map(ss => ({
          serviceId: ss.serviceId,
          optionId: ss.optionId ?? null,
          overrideDurationMin: ss.overrideDurationMin ?? null,
          prezzoOverride: ss.prezzoOverride ?? null,
          // V62: per-line paid round-trip.
          paid: ss.paid === true,
        })),
        customTotalDurationMin:
          totalDurationOverride ??
          (selectedPackageIds.size > 0 || selectedPromotionIds.size > 0 || selectedPackageCreditId != null || selectedServices.some(ss => ss.overrideDurationMin != null) ? totalDuration : null),
        // V64 M2a: whole-appointment custom total price (null = no override, per-line sum wins).
        customTotalPrice: totalPriceOverride ?? null,
        hasCustomService: customItems.length > 0,
        customServiceName: customItems.length > 0 ? customItems.map(i => i.customName.trim()).join(", ") : null,
        customServiceDurationMinutes: customItems.length > 0 ? customItems.reduce((s, i) => s + (parseInt(i.customDuration, 10) || 0), 0) : null,
        customServicePrice: customItems.length > 0 && customItems[0].customPrice ? parseFloat(customItems[0].customPrice) : null,
        // Phase 5b: send the full list. Singular packageAssignmentId is sent as null —
        // the Phase 5a backend wraps the singular as a one-element list only when the
        // list field is missing, so we explicitly use the new contract.
        packageAssignmentIds: Array.from(selectedPackageIds),
        packageAssignmentId: null,
        packageCreditId: selectedPackageCreditId ?? null,
        // 08.5: full set of attached promotions (empty ⇒ detach all, mirrors
        // packageAssignmentIds). promotionPaid keyed by promotionId.
        promotionIds: Array.from(selectedPromotionIds),
        promotionPaid: Object.fromEntries(promotionPaid),
        serviceOptionId: selectedServices[0]?.optionId ?? null, // backward compat; serviceEntries takes precedence
        // V62: per-line paid fields. paidInStore is intentionally NOT sent —
        // the legacy booking-level flag is being retired (V50 → V62) and the
        // backend no longer derives anything from drawer payloads on this field.
        customServicePaid: customItems.length > 0 ? customServicePaid : false,
        packageSessionPaid: Object.fromEntries(packageSessionPaid),
        // Block B: standalone product sales (extras). productId-keyed; the backend
        // reconciles them into booking_sales and moves stock. [] ⇒ remove all
        // standalone sales (pre-fill from linkedSales prevents wiping quick-add ones).
        saleEntries: selectedProducts
          .filter(p => p.productId && p.quantity >= 1)
          .map(p => ({
            productId: p.productId,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            paid: p.paid === true,
          })),
      };

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
              onNoMatch={setNoCustomerMatch}
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
              onChange={e => onPatchCustomer({ phone: e.target.value })}
              placeholder="Es. 333…"
            />
            {submitted && errors.customerPhone && <div className="nad-field-error">{errors.customerPhone}</div>}
          </div>
        </div>

        <div className="nad-form__row">
          <div className="nad-walkin-row">
            <label className="nad-form__label">Email {walkIn ? "" : "*"}</label>
            <label className="nad-switch-label">
              <input type="checkbox" className="nad-switch" checked={walkIn} onChange={e => onPatchCustomer({ walkIn: e.target.checked })} />
              <span>Walk-in (senza email)</span>
            </label>
          </div>
          <input
            type="email"
            className="nad-form__input"
            disabled={walkIn}
            value={walkIn ? "" : customerEmail}
            onChange={e => onPatchCustomer({ email: e.target.value })}
            placeholder={walkIn ? "Generata automaticamente" : "cliente@email.com"}
          />
          {submitted && errors.customerEmail && <div className="nad-field-error">{errors.customerEmail}</div>}
          {walkIn && <div className="nad-help">Per i walk-in viene generata una email tecnica automaticamente.</div>}
        </div>

        {/* Feature 2: appears only for an unsaved customer with no DB match and the
            minimum data present (name + phone, + email when not walk-in). */}
        {!customerId && noCustomerMatch && customerName.trim() && customerPhone.trim() && (walkIn || customerEmail.trim()) && (
          <div className="ag-customer-action-row">
            <button type="button" className="nad-btn nad-btn--primary" onClick={handleSaveCustomer} disabled={savingCustomer}>
              {savingCustomer ? "Salvataggio…" : "💾 Salva cliente"}
            </button>
            <span className="nad-help">Crea la cliente ora per poterle assegnare un pacchetto.</span>
          </div>
        )}
        {saveCustomerError && <div className="nad-form__error">{saveCustomerError}</div>}

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
      {activePackages.length > 0 && (
        <div className="nad-section ag-packages-section">
          <div className="ag-active-pkg-header">
            <span className="ag-active-pkg-header__icon">📦</span>
            <span className="ag-active-pkg-header__label">Pacchetti attivi</span>
          </div>

          {activePackages.length > 0 && (
            <>
              <div className="d-flex flex-wrap gap-2 mt-1">
                {activePackages.map(pkg => {
                  const sessionsUsed = pkg.totalSessions - pkg.sessionsRemaining;
                  const isOnline = pkg.source === "ONLINE";
                  const isSelected = isOnline ? selectedPackageCreditId === pkg.id : selectedPackageIds.has(pkg.id);
                  const handleClick = () => {
                    if (isOnline) {
                      // Online package credit: stays single (unchanged contract).
                      setSelectedPackageCreditId(isSelected ? null : pkg.id);
                    } else {
                      // Phase 5b: in-person packages toggle add/remove in the Set —
                      // multiple may be selected at the same time.
                      if (isSelected) {
                        deselectAdminPackage(pkg.id);
                      } else {
                        setSelectedPackageIds(prev => {
                          const next = new Set(prev);
                          next.add(pkg.id);
                          return next;
                        });
                      }
                    }
                    // Note: we no longer wipe selectedServices here — package and extras coexist.
                  };
                  const items = Array.isArray(pkg.items) ? [...pkg.items].sort((a, b) => a.position - b.position) : [];
                  const hasMultipleItems = items.length >= 2;
                  const isExpanded = expandedPkgIds.has(pkg.id);
                  // Chevron handlers must stop propagation so they never fire the parent's
                  // select/deselect handler (click on card body / Enter on focused card).
                  const onChevronClick = e => {
                    e.stopPropagation();
                    togglePkgExpansion(pkg.id);
                  };
                  const onChevronKeyDown = e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      togglePkgExpansion(pkg.id);
                    }
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
                        {hasMultipleItems && (
                          <>
                            <button type="button" className="pkgi-toggle" aria-expanded={isExpanded} onClick={onChevronClick} onKeyDown={onChevronKeyDown}>
                              <span className={`pkgi-toggle__chevron${isExpanded ? " is-expanded" : ""}`}>▸</span>
                              {items.length} trattamenti
                            </button>
                            {isExpanded && (
                              <ul className="pkgi-list">
                                {items.map(it => (
                                  <li key={it.id ?? it.position} className="pkgi-list__item">
                                    {formatPackageItemLabel(it)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
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
              {(selectedPackageIds.size > 0 || selectedPackageCreditId) && (
                <div className="nad-help mt-1">Seduta scalata automaticamente dal pacchetto al salvataggio.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Promozioni (08.5) — global, not customer-gated ─────────────────── */}
      {activePromotions.length > 0 && (
        <div className="nad-section ag-packages-section">
          <button
            type="button"
            className="ag-active-pkg-header"
            onClick={() => setPromosOpen(o => !o)}
            aria-expanded={promosOpen}
            style={{ background: "none", border: "none", padding: 0, width: "100%", cursor: "pointer", textAlign: "left" }}
          >
            <span className="ag-active-pkg-header__icon">🏷️</span>
            <span className="ag-active-pkg-header__label">Promozioni</span>
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", fontWeight: 500, color: "var(--card-gold-deep, #8c6d3f)" }}>
              {selectedPromotionIds.size > 0
                ? `${selectedPromotionIds.size} selezionat${selectedPromotionIds.size === 1 ? "a" : "e"} · `
                : ""}
              {activePromotions.length} disponibil{activePromotions.length === 1 ? "e" : "i"}
            </span>
            <span
              aria-hidden="true"
              style={{ marginLeft: 8, display: "inline-block", transition: "transform 0.15s ease", transform: promosOpen ? "rotate(90deg)" : "none" }}
            >
              ▸
            </span>
          </button>
          {promosOpen && (
            <>
          <div className="d-flex flex-wrap gap-2 mt-1">
            {activePromotions.map(promo => {
              const isSelected = selectedPromotionIds.has(promo.promotionId);
              const discount = getPromoDiscountLabel(promo);
              const svcCount = Array.isArray(promo.serviceIds) ? promo.serviceIds.length : 0;
              const prodCount = Array.isArray(promo.productIds) ? promo.productIds.length : 0;
              const dur = resolvePromoDuration(promo.promotionId);
              const onCardActivate = () => (isSelected ? deselectPromotion(promo.promotionId) : togglePromotion(promo.promotionId));
              return (
                <div
                  key={promo.promotionId}
                  className={`ag-pkg-select-card${isSelected ? " is-selected" : ""}`}
                  onClick={onCardActivate}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && onCardActivate()}
                >
                  <div className="ag-pkg-select-card__body">
                    <div className="ag-pkg-select-card__name">
                      🏷️ {promo.title || "Promozione"}
                      {discount && (
                        <span style={{ marginLeft: 6, fontSize: "0.72rem", fontWeight: 700, color: "var(--card-gold-deep, #8c6d3f)" }}>
                          {discount}
                        </span>
                      )}
                    </div>
                    <div className="ag-pkg-select-card__meta">
                      {dur > 0 && <>{formatDuration(dur)} · </>}
                      {svcCount} trattament{svcCount === 1 ? "o" : "i"}
                      {prodCount > 0 && <> · {prodCount} prodott{prodCount === 1 ? "o" : "i"}</>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedPromotionIds.size > 0 && (
            <div className="nad-help mt-1">Il prezzo della promozione viene applicato automaticamente al salvataggio.</div>
          )}
            </>
          )}
        </div>
      )}

      {/* ── Section 2: Servizi ─────────────────────────────────────────────── */}
      <div className="nad-section">
        <div className="nad-section__title">Servizi e prodotti</div>

        {/* Block B: switch the input between the service catalog and the product
            selector. The "Servizi selezionati" summary below stays visible in both. */}
        <div className="nad-form__chips" style={{ marginBottom: 10 }}>
          <button type="button" className={`nad-chip${itemMode === "servizi" ? " is-active" : ""}`} onClick={() => setItemMode("servizi")}>
            Servizi
          </button>
          <button type="button" className={`nad-chip${itemMode === "prodotti" ? " is-active" : ""}`} onClick={() => setItemMode("prodotti")}>
            🛍️ Prodotti
          </button>
        </div>

        {itemMode === "servizi" && (
          <>
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

        {/* ── Phase 6d: + Servizio personalizzato + inline form ─────────────── */}
        {!customForm.active ? (
          <button type="button" className="nad-add-service" onClick={openCreateCustomForm} style={{ marginTop: 12 }}>
            + Servizio personalizzato
          </button>
        ) : (
          <div className="nad-custom-form">
            <div className="nad-custom-form__title">{customForm.editingId ? "Modifica servizio personalizzato" : "Nuovo servizio personalizzato"}</div>
            <div className="nad-form__row">
              <label className="nad-form__label">Nome trattamento *</label>
              <input
                type="text"
                className="nad-form__input"
                value={customForm.name}
                onChange={e => setCustomForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Es. Trattamento personalizzato"
                maxLength={255}
                autoFocus
              />
            </div>
            <div className="nad-form__row nad-form__row--2col">
              <div>
                <DurationField
                  label="Durata *"
                  value={customForm.durationMinutes}
                  onChange={n => setCustomForm(prev => ({ ...prev, durationMinutes: n }))}
                  required
                />
              </div>
              <div>
                <label className="nad-form__label">Prezzo (€)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="nad-form__input"
                  value={customForm.price}
                  onChange={e => setCustomForm(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="Opzionale"
                />
              </div>
            </div>
            {customFormError && <div className="nad-field-error">{customFormError}</div>}
            <div className="nad-form__actions">
              <button type="button" className="nad-btn" onClick={cancelCustomForm}>
                Annulla
              </button>
              <button type="button" className="nad-btn nad-btn--primary" onClick={submitCustomForm}>
                Salva
              </button>
            </div>
          </div>
        )}
          </>
        )}

        {itemMode === "prodotti" && (
          <>
            <input
              type="text"
              className="ag-service-search"
              placeholder="Cerca prodotto…"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              autoComplete="off"
            />
            <div className="ag-service-list">
              {filteredProducts.length === 0 && (
                <div className="ag-service-empty">{productSearch.trim() ? "Nessun prodotto trovato." : "Nessun prodotto disponibile."}</div>
              )}
              {filteredProducts.map(p => {
                const inCart = selectedProducts.find(sp => sp.productId === p.productId);
                const remaining = productRemaining(p);
                const soldOut = remaining <= 0;
                return (
                  <button
                    key={p.productId}
                    type="button"
                    className={`ag-service-item${inCart ? " ag-service-item--selected" : ""}`}
                    disabled={soldOut}
                    onClick={() => addOrIncProduct(p)}
                  >
                    <span className="ag-service-item__title">{p.name}</span>
                    <span className="ag-service-item__meta">
                      {p.price != null ? formatEuro(p.price) : ""}
                      {" · "}
                      <span style={{ color: soldOut ? "#c0392b" : undefined }}>{Math.max(0, remaining)} disp.</span>
                    </span>
                    {inCart && <span className="ag-service-item__selected-count">×{inCart.quantity}</span>}
                  </button>
                );
              })}
            </div>
            <div className="nad-help">Tocca un prodotto per aggiungerlo. Quantità, prezzo e rimozione si gestiscono sotto, in "Servizi selezionati".</div>
          </>
        )}

        {/* ── Selected services panel ───────────────────────────────────────── */}
        {(selectedPackageIds.size > 0 || selectedPromotionIds.size > 0 || selectedServices.length > 0 || serviceItems.length > 0 || selectedProducts.length > 0) && (
          <div className="ag-selected-services">
            <div className="ag-selected-services__label">
              Servizi selezionati ({selectedPackageIds.size + selectedPromotionIds.size + selectedServices.length + serviceItems.length + selectedProducts.length})
            </div>
            {/* V62: bulk paid toggle. Counts editable lines (catalog rows +
                non-paidUpfront packages + custom-service line if present); a
                line is considered settled if its underlying state is true.
                Skips locked lines (paidUpfront, paidOnline). */}
            {(() => {
              if (isPaidOnline) return null;
              const editablePkgIds = Array.from(selectedPackageIds).filter(id => {
                const p = activePackages.find(pp => pp.id === id);
                return p && !p.paidUpfront;
              });
              const promoIds = Array.from(selectedPromotionIds);
              const hasCustomLine = serviceItems.length > 0;
              const editableCount = selectedServices.length + editablePkgIds.length + promoIds.length + (hasCustomLine ? 1 : 0) + selectedProducts.length;
              if (editableCount === 0) return null;
              const allSettled =
                selectedServices.every(ss => ss.paid === true) &&
                editablePkgIds.every(id => packageSessionPaid.get(id) === true) &&
                promoIds.every(id => promotionPaid.get(id) === true) &&
                (!hasCustomLine || customServicePaid) &&
                selectedProducts.every(p => p.paid === true);
              const flip = () => {
                const next = !allSettled;
                setSelectedServices(prev => prev.map(s => ({ ...s, paid: next })));
                setPackageSessionPaid(prev => {
                  const m = new Map(prev);
                  editablePkgIds.forEach(id => m.set(id, next));
                  return m;
                });
                setPromotionPaid(prev => {
                  const m = new Map(prev);
                  promoIds.forEach(id => m.set(id, next));
                  return m;
                });
                if (hasCustomLine) setCustomServicePaid(next);
                setSelectedProducts(prev => prev.map(p => ({ ...p, paid: next })));
              };
              return (
                <div className="ag-selected-services__bulk">
                  <button type="button" className="nad-chip" onClick={flip}>
                    {allSettled ? "↺ Segna tutto da pagare" : "✓ Tutto già pagato"}
                  </button>
                </div>
              );
            })()}
            {/* Phase 6a fix: in edit mode the per-link session number is FROZEN on
                the BookingPackageLink at create time — read it from
                editBooking.linkedPackages[] keyed by packageAssignmentId, NOT the
                live activePackages counter (which advances with later bookings). */}
            {Array.from(selectedPackageIds).map(pkgId => {
              const pkg = activePackages.find(p => p.id === pkgId);
              if (!pkg) return null;
              const overrideDur = packageDurationOverrides.get(pkgId) ?? null;
              const defaultDur = resolvePkgDuration(pkg, null);
              const displayDur = overrideDur ?? defaultDur;
              const isEditingDur = editingDurationPkgIds.has(pkgId);
              const isRowExpanded = expandedSelectedPkgIds.has(pkgId);
              // Per-package "Seduta X/Y":
              //   - edit mode + a frozen link exists for this pkgId → use the link's
              //     sessionNumber/totalSessions (the values captured at booking creation).
              //   - otherwise (create mode, or a package added during this edit session
              //     that has no link yet) → compute from the live package counter.
              const frozen = isEditMode
                ? (editBooking?.linkedPackages || []).find(lp => String(lp.packageAssignmentId) === String(pkgId))
                : null;
              const sessionNum = frozen?.sessionNumber ?? pkg.totalSessions - pkg.sessionsRemaining + 1;
              const totalSess = frozen?.totalSessions ?? pkg.totalSessions;
              const pkgItems = Array.isArray(pkg.items) ? [...pkg.items].sort((a, b) => a.position - b.position) : [];
              const hasMultipleItems = pkgItems.length >= 2;
              return (
                <div
                  key={pkgId}
                  className="ag-selected-service-row"
                  style={{ background: "rgba(184, 151, 106, 0.08)", borderLeft: "3px solid var(--card-gold, #b8976a)", flexWrap: "wrap" }}
                >
                  <span className="ag-selected-service-row__name">
                    📦 {pkg.displayName || pkg.serviceTitle || "Pacchetto"}
                    <span className="ag-pkg-session-badge" style={{ marginLeft: 8 }}>
                      Seduta {sessionNum}/{totalSess}
                    </span>
                    {hasMultipleItems && (
                      <button
                        type="button"
                        className="pkgi-toggle"
                        aria-expanded={isRowExpanded}
                        onClick={() => toggleSelectedPkgExpansion(pkgId)}
                        style={{ marginLeft: 8 }}
                      >
                        <span className={`pkgi-toggle__chevron${isRowExpanded ? " is-expanded" : ""}`}>▸</span>
                        {pkgItems.length} trattamenti
                      </button>
                    )}
                  </span>
                  {isEditingDur ? (
                    <>
                      <DurationField
                        value={displayDur}
                        onChange={n => {
                          setPackageDurationOverrides(prev => {
                            const next = new Map(prev);
                            if (n != null && n > 0 && n !== defaultDur) next.set(pkgId, n);
                            else next.delete(pkgId);
                            return next;
                          });
                        }}
                      />
                      <button
                        type="button"
                        className="ag-selected-service-row__edit"
                        title="Conferma durata"
                        onClick={() => toggleEditingDurationPkg(pkgId, false)}
                      >
                        ✓
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="ag-selected-service-row__dur">
                        {formatDuration(displayDur)}
                        {overrideDur != null && overrideDur !== defaultDur && (
                          <span className="ag-selected-service-row__orig"> (era {formatDuration(defaultDur)})</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="ag-selected-service-row__edit"
                        title="Modifica durata del pacchetto per questo appuntamento"
                        onClick={() => toggleEditingDurationPkg(pkgId, true)}
                      >
                        ✏
                      </button>
                    </>
                  )}
                  {/* V62: package session paid status. Locked when paidUpfront
                      (the whole package is prepaid — ADMIN with paid_upfront=TRUE
                      OR ONLINE/PackageCredit-backed; same predicate as edit mode)
                      or when the booking is paidOnline (Stripe-settled). The
                      paidUpfront flag is now exposed on UnifiedActivePackageDTO
                      so the lock fires identically in create and edit mode. */}
                  {(() => {
                    const locked = pkg.paidUpfront || isPaidOnline;
                    const settled = locked || packageSessionPaid.get(pkgId) === true;
                    if (locked) {
                      return (
                        <span
                          className="ag-pill ag-pill--paid"
                          title={pkg.paidUpfront ? "Pacchetto pagato in anticipo" : "Pagato online"}
                          aria-disabled="true"
                        >
                          🔒 Già pagato
                        </span>
                      );
                    }
                    return (
                      <button
                        type="button"
                        className={`ag-pill ag-pill--toggle ${settled ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                        title={settled ? "Segna questa seduta come da pagare" : "Segna questa seduta come pagata"}
                        onClick={() => setPackageSessionPaid(prev => {
                          const m = new Map(prev);
                          m.set(pkgId, !settled);
                          return m;
                        })}
                      >
                        {settled ? "✓ Pagato" : "⏳ Da pagare"}
                      </button>
                    );
                  })()}
                  {!isEditMode && (
                    <button
                      type="button"
                      className="ag-selected-service-row__remove"
                      title="Rimuovi pacchetto"
                      onClick={() => deselectAdminPackage(pkgId)}
                    >
                      ✕
                    </button>
                  )}
                  {hasMultipleItems && isRowExpanded && (
                    <ul className="pkgi-list">
                      {pkgItems.map(it => (
                        <li key={it.id ?? it.position} className="pkgi-list__item">
                          {formatPackageItemLabel(it)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {/* 08.5: promo rows — 🏷️ title + duration + paid toggle. No session
                badge (promos have no sessions). Removable only in create, mirroring
                packages; in edit the top selector still toggles attach. */}
            {Array.from(selectedPromotionIds).map(promoId => {
              const meta = resolvePromoMeta(promoId);
              const dur = resolvePromoDuration(promoId);
              const settled = isPaidOnline || promotionPaid.get(promoId) === true;
              return (
                <div
                  key={promoId}
                  className="ag-selected-service-row"
                  style={{ background: "rgba(184, 151, 106, 0.08)", borderLeft: "3px solid var(--card-gold, #b8976a)", flexWrap: "wrap" }}
                >
                  <span className="ag-selected-service-row__name">
                    🏷️ {meta.title}
                    {meta.serviceNames.length > 0 && (
                      <span className="ag-selected-service-row__orig"> · {meta.serviceNames.join(", ")}</span>
                    )}
                  </span>
                  <span className="ag-selected-service-row__dur">{dur > 0 ? formatDuration(dur) : "—"}</span>
                  {isPaidOnline ? (
                    <span className="ag-pill ag-pill--paid" title="Pagato online">✓ Già pagato</span>
                  ) : (
                    <button
                      type="button"
                      className={`ag-pill ag-pill--toggle ${settled ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                      title={settled ? "Segna come da pagare" : "Segna come pagata"}
                      onClick={() =>
                        setPromotionPaid(prev => {
                          const m = new Map(prev);
                          m.set(promoId, !settled);
                          return m;
                        })
                      }
                    >
                      {settled ? "✓ Pagato" : "⏳ Da pagare"}
                    </button>
                  )}
                  {!isEditMode && (
                    <button
                      type="button"
                      className="ag-selected-service-row__remove"
                      title="Rimuovi promozione"
                      onClick={() => deselectPromotion(promoId)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
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
                {/* V62: per-line paid toggle (catalog row). Locked when paidOnline. */}
                {(() => {
                  const settled = isPaidOnline || ss.paid === true;
                  if (isPaidOnline) {
                    return <span className="ag-pill ag-pill--paid" title="Pagato online">✓ Già pagato</span>;
                  }
                  return (
                    <button
                      type="button"
                      className={`ag-pill ag-pill--toggle ${settled ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                      title={settled ? "Segna come da pagare" : "Segna come pagato"}
                      onClick={() => setSelectedServices(prev => prev.map(s => (s.uid === ss.uid ? { ...s, paid: !settled } : s)))}
                    >
                      {settled ? "✓ Pagato" : "⏳ Da pagare"}
                    </button>
                  );
                })()}
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
            {/* Phase 6d: custom services render as first-class rows in this panel,
                same typography + ✏/✕ affordances as catalog rows. */}
            {serviceItems.map(item => {
              const durMin = parseInt(item.customDuration, 10) || 0;
              const rowError = submitted ? (itemErrors[item.id] ?? null) : null;
              return (
                <div key={item.id} className="ag-selected-service-row">
                  <span className="ag-selected-service-row__name">{item.customName || <em>Senza nome</em>}</span>
                  <span className="ag-selected-service-row__dur">{durMin > 0 ? formatDuration(durMin) : "—"}</span>
                  {item.customPrice !== "" && item.customPrice != null && (
                    <span className="ag-selected-service-row__price-override">
                      €{Number(item.customPrice).toFixed(0)}{" "}
                      <span className="ag-selected-service-row__price-tag">personalizzato</span>
                    </span>
                  )}
                  {/* V62: custom-service paid toggle. All custom rows share a
                      single backend line (the drawer joins them into one
                      custom_service_name), so all toggles bind to the same
                      customServicePaid state. */}
                  {(() => {
                    const settled = isPaidOnline || customServicePaid;
                    if (isPaidOnline) {
                      return <span className="ag-pill ag-pill--paid" title="Pagato online">✓ Già pagato</span>;
                    }
                    return (
                      <button
                        type="button"
                        className={`ag-pill ag-pill--toggle ${settled ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                        title={settled ? "Segna come da pagare" : "Segna come pagato"}
                        onClick={() => setCustomServicePaid(!settled)}
                      >
                        {settled ? "✓ Pagato" : "⏳ Da pagare"}
                      </button>
                    );
                  })()}
                  <button
                    type="button"
                    className="ag-selected-service-row__edit"
                    title="Modifica servizio personalizzato"
                    onClick={() => openEditCustomForm(item)}
                  >
                    ✏
                  </button>
                  <button
                    type="button"
                    className="ag-selected-service-row__remove"
                    title="Rimuovi"
                    onClick={() => removeServiceItem(item.id)}
                  >
                    ✕
                  </button>
                  {rowError && <span className="nad-field-error" style={{ flexBasis: "100%" }}>{rowError}</span>}
                </div>
              );
            })}
            {/* 🛍️ Prodotti group (Block B) — products affect price only, never duration. */}
            {selectedProducts.length > 0 && (
              <>
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(184,151,106,0.45)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--card-gold-deep, #8c6d3f)" }}>
                  🛍️ Prodotti
                </div>
                {selectedProducts.map(prod => {
                  const catalog = productCatalog.find(p => p.productId === prod.productId);
                  const maxQty = catalog ? Number(catalog.stock ?? 0) + (savedSaleQtyByProduct.get(prod.productId) ?? 0) : prod.quantity;
                  return (
                    <SelectedProductRow
                      key={prod.productId}
                      prod={prod}
                      maxQty={maxQty}
                      isPaidOnline={isPaidOnline}
                      onQty={changeProductQty}
                      onPrice={setProductUnitPrice}
                      onPaid={setProductPaid}
                      onRemove={removeProduct}
                    />
                  );
                })}
                <div className="ag-selected-services__total">
                  <span>Subtotale prodotti: <b>{formatEuro(productsSubtotal)}</b></span>
                </div>
              </>
            )}
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
                    <>
                      <DurationField
                        value={displayTotal}
                        onChange={n => setTotalDurationOverride(n != null && n > 0 && n !== computedTotal ? n : null)}
                      />
                      <button
                        type="button"
                        className="ag-selected-service-row__edit"
                        title="Conferma durata"
                        onClick={() => setEditingTotalDuration(false)}
                      >
                        ✓
                      </button>
                    </>
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
            {/* V64 M2a: whole-appointment custom total price override (override-only, no baseline). */}
            {(() => {
              const commit = () => {
                const v = priceDraft.trim();
                setTotalPriceOverride(v === "" ? null : (parseFloat(v) >= 0 ? parseFloat(v) : null));
                setEditingTotalPrice(false);
              };
              return (
                <div className="ag-selected-services__total">
                  <span>
                    Prezzo totale: <b>{totalPriceOverride !== null ? `€${Number(totalPriceOverride).toFixed(2)}` : "—"}</b>
                  </span>
                  {totalPriceOverride !== null && <span className="ag-selected-services__manual-note"> · impostato manualmente</span>}
                  {!editingTotalPrice ? (
                    <button
                      type="button"
                      className="ag-selected-service-row__edit"
                      title="Imposta un prezzo totale unico per l'appuntamento (es. due servizi venduti insieme)"
                      onClick={() => {
                        setPriceDraft(totalPriceOverride != null ? String(totalPriceOverride) : "");
                        setEditingTotalPrice(true);
                      }}
                    >
                      ✏
                    </button>
                  ) : (
                    <>
                      <input
                        type="number"
                        className="ag-edit-svc-input"
                        min={0}
                        step={0.5}
                        value={priceDraft}
                        placeholder="€ totale"
                        autoFocus
                        onChange={e => setPriceDraft(e.target.value)}
                        onBlur={commit}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commit();
                          }
                        }}
                      />
                      <button type="button" className="ag-selected-service-row__edit" title="Conferma prezzo" onClick={commit}>
                        ✓
                      </button>
                    </>
                  )}
                  {totalPriceOverride !== null && (
                    <button
                      type="button"
                      className="ag-selected-service-row__edit"
                      style={{ fontSize: ".72rem" }}
                      onClick={() => {
                        setTotalPriceOverride(null);
                        setEditingTotalPrice(false);
                      }}
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

        {serviceItems.length > 0 && <div className="nad-help">I servizi personalizzati non sono visibili ai clienti.</div>}
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
            // Phase 6d: when the admin picks a different date, the old time
            // probably doesn't fit the new day's slots — clear it here so the
            // grid + custom-time picker reset together. The slot-fetch effect
            // no longer does this implicitly (it would otherwise nuke the
            // edit-mode preselected time on async re-fetch).
            setSelectedSlot("");
            setCustomTime("");
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
      {/* V62: the booking-level "già pagato" toggle moved into the per-line
          panel above (catalog rows, package sessions, custom service). */}
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
        <div className="nad-form__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="nad-form__actions">
        {/* New appointment only (onReset is undefined in edit/duplicate): wipe the
            whole draft and start clean via a remount. */}
        {onReset && (
          <button type="button" className="nad-btn" onClick={onReset} disabled={submitting}>
            ↺ Nuovo appuntamento
          </button>
        )}
        <button type="submit" className="nad-btn nad-btn--primary" disabled={submitting}>
          {submitting ? "Salvataggio…" : isEditMode ? "Salva modifiche" : "Crea appuntamento"}
        </button>
      </div>

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

      {editingActivePkg && (
        <EditPackageModal pkg={editingActivePkg} services={services} onClose={() => setEditingActivePkg(null)} onSave={handleActivePkgSaved} />
      )}

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
          <TimePicker label="Ora inizio *" value={startTime} onChange={v => setStartTime(v)} />
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

  // ── Customer identity (shared by Appuntamento + Pacchetti tabs) ──────────
  const [customer, setCustomer] = useState(() => deriveCustomer(editBooking));
  const patchCustomer = useCallback(partial => setCustomer(p => ({ ...p, ...partial })), []);
  const handleSelectCustomer = useCallback(c => {
    setCustomer(prev => {
      const next = { ...prev, customerId: c.customerId ?? null, fullName: c.fullName, phone: c.phone ?? prev.phone };
      if (c.email && !isWalkInEmail(c.email)) {
        next.email = c.email;
        next.walkIn = false;
      }
      return next;
    });
  }, []);

  // ── In-memory draft snapshot (Feature 1) ─────────────────────────────────
  // The shell is permanently mounted (the page renders it unconditionally), so a
  // ref here survives the drawer's close/reopen. The snapshot holds the
  // NEW-appointment draft only: { form, customer }. Edit/duplicate never read or
  // write it (onDraftChange/initialDraft are gated on editBooking == null).
  const draftRef = useRef(null);
  // Set right before a successful new-appt create, so the close that follows
  // doesn't repopulate the just-cleared snapshot via the unmount/close captures.
  const suppressCaptureRef = useRef(false);
  // Live mirror of customer, read by the close-time capture without stale closures.
  const customerRef = useRef(customer);
  customerRef.current = customer;
  // Live form capture from AppointmentForm (form part only; customer is captured
  // separately on close to avoid the open-transition stale-read race).
  const captureFormDraft = useCallback(form => {
    if (suppressCaptureRef.current) return;
    draftRef.current = { ...(draftRef.current || {}), form };
  }, []);

  // ── Reset / Nuovo appuntamento (Feature 1) ───────────────────────────────
  // Wipe the draft and start a clean new appointment. Bumping resetNonce changes
  // the new-appointment key, remounting AppointmentForm so EVERY useState
  // initializer re-runs to its blank default — no satellite collection can be
  // missed. Nulling draftRef first makes the remount read initialDraft=null; the
  // fresh form's first onDraftChange then re-seeds the snapshot as blank.
  const [resetNonce, setResetNonce] = useState(0);
  const handleResetDraft = useCallback(() => {
    draftRef.current = null;
    setCustomer(deriveCustomer(null));
    setResetNonce(n => n + 1);
  }, []);

  // (Re)open: edit/duplicate rebuild from editBooking; a new appointment restores
  // the customer from the snapshot. Also clears the post-submit suppress flag.
  useEffect(() => {
    if (!isOpen) return;
    suppressCaptureRef.current = false;
    if (editBooking) setCustomer(deriveCustomer(editBooking));
    else setCustomer(draftRef.current?.customer ?? deriveCustomer(null));
  }, [isOpen, editBooking]);

  // Capture the customer into the new-appt draft when the drawer closes (cleanup
  // fires on isOpen→false). Guarded so edit/duplicate and post-submit don't write.
  useEffect(() => {
    if (!isOpen) return;
    return () => {
      if (suppressCaptureRef.current || editBooking) return;
      draftRef.current = { ...(draftRef.current || {}), customer: customerRef.current };
    };
  }, [isOpen, editBooking]);

  // Problem 4: after "Crea pacchetto" the appointment tab stays mid-list because
  // scrollTop on .nad-content carries over from the Pacchetti tab. Reset it AFTER
  // the appointment tabpanel is mounted (post-tab-switch) — a ref-flag + effect
  // keyed on activeTab is the simplest "wait for mount" without RAF gymnastics.
  const nadContentRef = useRef(null);
  const justCreatedPackageRef = useRef(false);
  const handlePackageCreated = useCallback(() => {
    justCreatedPackageRef.current = true;
    setActiveTab("appointment");
  }, []);

  useEffect(() => {
    if (activeTab !== "appointment" || !justCreatedPackageRef.current) return;
    justCreatedPackageRef.current = false;
    nadContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

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

  // Portale su document.body: position:fixed dev'essere ancorato al viewport,
  // non al containing block creato da PageTransition (will-change/filter sulla
  // motion.div). Stesso pattern di PromoDetailDrawer.
  return ReactDOM.createPortal(
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
              aria-selected={activeTab === "packages"}
              className={`nad-tab${activeTab === "packages" ? " is-active" : ""}`}
              onClick={() => setActiveTab("packages")}
            >
              Pacchetti
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
        <div ref={nadContentRef} className="nad-content" role="tabpanel" onWheel={e => e.stopPropagation()}>
          {activeTab === "appointment" && (
            <AppointmentForm
              // resetNonce only affects the NEW-appointment key, so Reset remounts a
              // blank form without touching the edit/duplicate keys.
              key={isOpen ? `open-${editBooking?._duplicate ? `dup-${editBooking?.bookingId}` : (editBooking?.bookingId ?? `new-${resetNonce}`)}` : "closed"}
              services={services}
              selectedDate={selectedDate}
              editBooking={editBooking}
              customer={customer}
              onSelectCustomer={handleSelectCustomer}
              onPatchCustomer={patchCustomer}
              // New appointment only: rehydrate from / report to the shell snapshot,
              // and expose Reset. All three are absent in edit/duplicate.
              initialDraft={editBooking ? null : (draftRef.current?.form ?? null)}
              onDraftChange={editBooking ? undefined : captureFormDraft}
              onReset={editBooking ? undefined : handleResetDraft}
              onSuccess={msg => {
                // A new appointment was persisted — drop the draft and suppress the
                // close-time captures that would otherwise repopulate it.
                if (!editBooking) {
                  draftRef.current = null;
                  suppressCaptureRef.current = true;
                }
                onAppointmentSaved?.(msg);
                onClose();
              }}
            />
          )}

          {activeTab === "packages" && <PackagesTab customer={customer} services={services} isOpen={isOpen} onPackageCreated={handlePackageCreated} />}

          {activeTab === "personal" && (
            <PersonalForm selectedDate={selectedDate} editingPersonal={editingPersonal} onPersonalSaved={onPersonalSaved} onClose={onClose} />
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
