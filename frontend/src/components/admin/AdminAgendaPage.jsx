import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import {
  getTimelineDay,
  getBookingsDay,
  patchBookingStatus,
  settleBookingLines,
  deleteBooking,
  updateBooking,
  getNextAvailableSlot,
  patchBookingPadding,
  patchBookingReminder,
  refundBooking,
  patchBookingConsent,
  getPersonalAppointmentsDay,
  getClosuresRange,
  fetchArretratiForBooking,
} from "../../api/modules/adminAgenda.api";
import { buildReminderMessage, buildWhatsAppUrl, isLaserBooking } from "../../utils/reminders";
import { formatEuro } from "../../utils/formatEuro";
import BookingModal from "./BookingModal";
import CompletionDrawer from "./CompletionDrawer";
import { pushLenisLock, popLenisLock } from "../../hooks/useLenis";
import NewAppointmentDrawer from "../../features/admin/NewAppointmentDrawer";
import ClosuresDrawer from "../../features/admin/ClosuresDrawer";
import ConfirmDialog from "../common/ConfirmDialog";
import WeeklyCalendar from "./WeeklyCalendar";
import { VerifiedBadge, OnlineBadge, PaidOnlineBadge } from "./AgendaBadges";
import { createAdminBooking } from "../../api/modules/bookings.api";
import { fetchServices } from "../../api/modules/services.api";
import DateTimeField from "../common/DateTimeField";
import SEO from "../common/SEO";
import formatDuration from "../../utils/formatDuration";
import formatPackageItemLabel from "../../utils/formatPackageItemLabel";
import { buildArretratoSettlePayload } from "./settlePayload";
import useInstallmentsDue from "../../hooks/useInstallmentsDue";
import InstallmentPlanPill from "./installments/InstallmentPlanPill";
import InstallmentDueAction from "./installments/InstallmentDueAction";
import InstallmentsDueSection from "./installments/InstallmentsDueSection";
// pkgi-* classes for the collapsible package items toggle
import "./PackageForm.css";

// Digits-only phone (mirror of the backend digitsOnly / SQL regexp_replace) — used to
// clear the agenda arretrati badge across all cards of the same customer after settling.
const digitsOnly = s => (s ? String(s).replace(/[^0-9]/g, "") : "");

const pad2 = n => String(n).padStart(2, "0");
const toISODate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromISODateLocal = iso => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
const minutes = hhmm => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtTime = dt => new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Phase 6c: refined palette in the Editorial Beauty family — warm muted tones
// only. Each entry stays tasteful while staying distinguishable at a glance.
// The first entry remains the warm-brown-gold "primary" so untagged data still
// reads as on-brand. Refined from the prior loud primaries (indigo / pink /
// teal / orange) that didn't fit the cream/gold palette.
const CATEGORY_PALETTE = [
  { bg: "rgba(184, 151, 106, 0.22)", border: "#b8976a", text: "#6b4226" }, // warm brown gold
  { bg: "rgba(199, 134, 142, 0.22)", border: "#c7868e", text: "#7a3a4a" }, // dusty rose
  { bg: "rgba(150, 170, 130, 0.24)", border: "#a3b88c", text: "#4a6b3a" }, // muted sage
  { bg: "rgba(170, 150, 190, 0.22)", border: "#b09cc4", text: "#5a4a78" }, // soft lavender
  { bg: "rgba(217, 175, 110, 0.24)", border: "#d9af6e", text: "#7a5223" }, // honey amber
  { bg: "rgba(140, 162, 184, 0.22)", border: "#94a8c0", text: "#3a5278" }, // dusk slate blue
  { bg: "rgba(190, 130, 95, 0.22)", border: "#c98563", text: "#7a3e1a" }, // terracotta clay
];
const categoryColor = cat => {
  if (!cat) return CATEGORY_PALETTE[0];
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffff;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length];
};

const openWhatsApp = phone => {
  if (!phone) return;
  const clean = phone.replace(/[\s\-().+]/g, "");
  const number = clean.startsWith("39") ? clean : `39${clean}`;
  window.open(`https://wa.me/${number}`, "_blank", "noopener,noreferrer");
};

const STATUS_META = {
  PENDING: { label: "In attesa", tone: "pending" },
  PENDING_PAYMENT: { label: "Attesa pagamento", tone: "pending" },
  NO_SHOW: { label: "Non presentata", tone: "noshow" },
  CONFIRMED: { label: "Confermato", tone: "confirmed" },
  COMPLETED: { label: "Completato", tone: "completed" },
  CANCELLED: { label: "Cancellato", tone: "cancelled" },
};

function StatusPill({ status }) {
  const s = STATUS_META[status] || { label: status, tone: "neutral" };
  return <span className={`ag-pill ag-pill--${s.tone}`}>{s.label}</span>;
}

// Abbrevia "Mario Rossi" → "Mario R."
function shortCustomerName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ── V62: single source of truth for "settled" ────────────────────────────────
// A line is settled when:
//   • its own paid flag is true (catalog / package / custom)
//   • OR the booking is paidOnline (Stripe) — everything is treated as settled
//   • PackageSummaryDTO.paid already folds in paidUpfront (backend), so checking
//     pkg.paid is enough — no need to look at paidUpfront separately here.
// PackageCredit-backed bookings (online-bought packages consumed offline) carry
// packageCreditId and never appear in linkedPackages; treat them as settled too.
function isBookingPackageCreditBacked(b) {
  return b?.packageCreditId != null;
}
function isLineSettled(line, booking) {
  if (booking?.paidOnline || isBookingPackageCreditBacked(booking)) return true;
  return line?.paid === true;
}
function isCustomSettled(booking) {
  if (booking?.paidOnline || isBookingPackageCreditBacked(booking)) return true;
  return booking?.customServicePaid === true;
}
function isAppointmentFullySettled(booking) {
  if (!booking) return false;
  if (booking.paidOnline || isBookingPackageCreditBacked(booking)) return true;
  const pkgs = booking.linkedPackages?.length
    ? booking.linkedPackages
    : booking.linkedPackage ? [booking.linkedPackage] : [];
  const svcs = Array.isArray(booking.services) ? booking.services : [];
  const hasCustom = !!(booking.isCustomService && booking.customServiceName);
  // Need at least one priced line to be meaningful; otherwise leave it unmarked.
  if (pkgs.length === 0 && svcs.length === 0 && !hasCustom) return false;
  return svcs.every(s => s.paid === true)
    && pkgs.every(p => p.paid === true)
    && (!hasCustom || booking.customServicePaid === true);
}

// ── EstimatoModal helpers ────────────────────────────────────────────────────

function buildBreakdownItems(booking, priceMap) {
  const items = [];

  // Phase 6: linkedPackages[] is the source of truth; legacy singular linkedPackage
  // is wrapped into a one-element list for pre-5a bookings.
  const pkgs = booking.linkedPackages?.length
    ? booking.linkedPackages
    : booking.linkedPackage
      ? [booking.linkedPackage]
      : [];
  const isLegacySingle = !booking.linkedPackages?.length && !!booking.linkedPackage;

  // a. Package contribution — one row per linked package
  pkgs.forEach((pkg, idx) => {
    const name = pkg.packageName || pkg.serviceTitle || pkg.serviceName || "Pacchetto";
    // Per-package counters (Phase 6 DTO). Pre-5a bookings only carry the first
    // link via booking-level fields; honor those for the legacy-single case.
    const sessionNum = pkg.sessionNumber ?? (idx === 0 ? booking.currentSession : null);
    const totalSess = pkg.totalSessions ?? (idx === 0 ? booking.totalSessions : null);
    const suffix = sessionNum && totalSess ? ` · Seduta ${sessionNum}/${totalSess}` : "";
    const label = `📦 ${name}${suffix}`;
    let price = null;
    if (pkg.sessionPrice != null) price = Number(pkg.sessionPrice);
    else if (isLegacySingle && booking.optionPrice != null) price = Number(booking.optionPrice);
    else if (isLegacySingle) {
      const p = priceMap.get(String(booking.serviceId));
      if (p != null) price = p;
    }
    // refKind/refId/locked: drive the CompletionDrawer settle payload (packageSessionPaid
    // keyed by ClientPackageAssignment id). paidUpfront packages are not editable.
    items.push({
      label, price, kind: "package", paid: isLineSettled(pkg, booking),
      refKind: "package", refId: pkg.packageAssignmentId, locked: pkg.paidLocked === true,
      paymentMode: pkg.paymentMode,
    });
  });

  // b. Extras from booking.services
  if (Array.isArray(booking.services) && booking.services.length > 0) {
    booking.services.forEach((s, i) => {
      const name = s.name || s.title || s.serviceName || "?";
      const label = s.optionName ? `${name} · ${s.optionName}` : name;
      let price;
      if (pkgs.length === 0 && i === 0 && booking.optionPrice != null && !s.optionId) {
        price = Number(booking.optionPrice);
      } else if (s.price != null) {
        price = Number(s.price);
      } else {
        const p = priceMap.get(String(s.id ?? s.serviceId));
        price = p != null ? p : null;
      }
      // refId = catalog service_id (servicePaid map key in the settle payload).
      items.push({
        label, price, kind: "extra", paid: isLineSettled(s, booking),
        refKind: "service", refId: s.id,
      });
    });
  }

  // c. Custom service
  if (booking.customServicePrice != null || (booking.customServiceName && booking.customServiceName.trim() !== "")) {
    items.push({
      label: booking.customServiceName || "Servizio personalizzato",
      price: booking.customServicePrice != null ? Number(booking.customServicePrice) : null,
      kind: "custom",
      paid: isCustomSettled(booking),
      refKind: "custom",
    });
  }

  // c-bis. Promotions (frozen snapshot). One atomic row per linked promotion —
  // 🏷️ title + the bundle's discounted total — mirroring the agenda card and the
  // package treatment. Without this branch a promo-only booking falls through to
  // the legacy "—" fallback below, can't be settled from the CompletionDrawer, and
  // never contributes to "incasso stimato".
  const promos = Array.isArray(booking.linkedPromotions) ? booking.linkedPromotions : [];
  promos.forEach(promo => {
    items.push({
      label: `🏷️ ${promo.title || "Promozione"}`,
      price: promo.totalDiscounted != null ? Number(promo.totalDiscounted) : null,
      kind: "promotion",
      // paid via isLineSettled so Stripe paidOnline OR the per-link paid flag settles it.
      paid: isLineSettled(promo, booking),
      // refId = promotionId (the settle map key). A deleted-promo link has a null
      // promotionId and can't be settled → locked; paidOnline locks too.
      refKind: "promotion",
      refId: promo.promotionId,
      locked: promo.promotionId == null || booking.paidOnline === true,
    });
  });

  // e. Standalone product sales (Block B). booking_sales with promotionLinkId == null
  // (promo-linked sales are folded into the promotion row above). Each is an individual
  // priced line settled by its OWN paid flag (salePaid map) — never by paidOnline (admin
  // adds these in-store) and never by the bundle markAllPaid (kept separate so a single
  // unpaid product never re-dues the whole bundle — see computeBookingAmountDue).
  const sales = Array.isArray(booking.linkedSales) ? booking.linkedSales : [];
  sales.forEach(sale => {
    const qty = sale.quantity ?? 1;
    const unit = sale.unitPrice != null ? Number(sale.unitPrice) : null;
    items.push({
      label: `🛍️ ${sale.productName || "Prodotto"}${qty > 1 ? ` ×${qty}` : ""}`,
      price: unit != null ? unit * qty : null,
      kind: "sale",
      paid: sale.paid === true,
      refKind: "sale",
      refId: sale.saleId,
    });
  });

  // d. Legacy fallback
  if (items.length === 0) {
    items.push({
      label: (booking.serviceTitle ?? "—") + (booking.optionName ? ` · ${booking.optionName}` : ""),
      price: booking.optionPrice != null ? booking.optionPrice : (priceMap.get(String(booking.serviceId)) ?? null),
      kind: "legacy",
      // No per-line flag exists for the legacy single-service shape: fall back to
      // booking-level paidOnline / packageCredit only.
      paid: booking.paidOnline || isBookingPackageCreditBacked(booking),
      refKind: "legacy", refId: booking.serviceId,
    });
  }

  return items;
}

// V64: single source of truth for a booking's "da incassare" (still-to-collect).
// Bundle appointments (customTotalPrice set) are one atomic price; otherwise it is
// the sum of unpaid lines. paidOnline / PackageCredit exclusions are already folded
// into it.paid via isLineSettled (inside buildBreakdownItems), so the caller just
// passes the items it already built. Used by BOTH the EstimatoModal and the agenda
// "incasso stimato" KPI to keep the two figures consistent.
function computeBookingAmountDue(booking, items) {
  const isBundle = booking.customTotalPrice != null;
  // Products (kind "sale") are always individual priced rows — never part of the
  // manual bundle price. Sum their own unpaid rows.
  const saleDue = items
    .filter(it => it.kind === "sale" && !it.paid)
    .reduce((acc, it) => acc + Number(it.price ?? 0), 0);
  if (!isBundle) {
    // Non-bundle: every unpaid line (services + products) counts at its own price.
    return items.filter(it => !it.paid).reduce((acc, it) => acc + Number(it.price ?? 0), 0);
  }
  // Bundle: customTotalPrice is the all-or-nothing price for the NON-sale lines only
  // (services/packages/promos), settled lockstep. Gate it on the non-sale lines so a
  // single unpaid product never re-triggers the whole bundle, then add unpaid products.
  const bundleUnpaid = items.some(it => it.kind !== "sale" && !it.paid);
  return (bundleUnpaid ? Number(booking.customTotalPrice) : 0) + saleDue;
}

// Snapshot of the CURRENT (pre-completion) paid flags as a /settle-style payload.
// Stored in completedUndo so "Annulla completamento" can restore the exact flags
// (symmetric undo). Bundle → single lockstep value; non-bundle → per-line maps.
// Locked lines are skipped (backend ignores them either way). alsoComplete is added
// by the caller (false on restore).
function buildSnapshotPayload(booking, items) {
  if (booking.customTotalPrice != null) {
    // Bundle: markAllPaid reflects the NON-sale lines (services). Products are settled
    // individually (salePaid) even in bundle mode (CompletionDrawer products section), so
    // capture their pre-completion paid state too for a faithful undo.
    const nonSale = items.filter(it => it.kind !== "sale");
    const snap = { markAllPaid: nonSale.length > 0 && nonSale.every(it => it.paid) };
    const salePaid = {};
    items.forEach(it => {
      if (it.kind === "sale" && it.refId != null) salePaid[String(it.refId)] = it.paid === true;
    });
    if (Object.keys(salePaid).length) snap.salePaid = salePaid;
    return snap;
  }
  const servicePaid = {};
  const packageSessionPaid = {};
  let customServicePaid;
  const promotionPaid = {};
  const salePaid = {};
  items.forEach(it => {
    if (it.locked) return;
    if (it.refKind === "service" || it.refKind === "legacy") {
      if (it.refId != null) servicePaid[String(it.refId)] = it.paid === true;
    } else if (it.refKind === "package") {
      if (it.refId != null) packageSessionPaid[String(it.refId)] = it.paid === true;
    } else if (it.refKind === "custom") {
      customServicePaid = it.paid === true;
    } else if (it.refKind === "promotion") {
      if (it.refId != null) promotionPaid[String(it.refId)] = it.paid === true;
    } else if (it.refKind === "sale") {
      if (it.refId != null) salePaid[String(it.refId)] = it.paid === true;
    }
  });
  const snap = { servicePaid, packageSessionPaid };
  if (Object.keys(promotionPaid).length) snap.promotionPaid = promotionPaid;
  if (Object.keys(salePaid).length) snap.salePaid = salePaid;
  if (customServicePaid !== undefined) snap.customServicePaid = customServicePaid;
  return snap;
}

// V62: column-level booking status. New bookings no longer write paid_in_store;
// the "In negozio" label is kept only as a fallback for legacy rows that still
// carry the dormant flag set to TRUE.
function getPaymentLabel(booking) {
  if (booking.paidOnline) return { icon: "💳", text: "Online", css: "ag-pay--online" };
  if (isAppointmentFullySettled(booking)) return { icon: "✓", text: "Saldato", css: "ag-pay--instore" };
  if (booking.paidInStore) return { icon: "💵", text: "In negozio", css: "ag-pay--instore" };
  return { icon: "⏳", text: "Da pagare", css: "ag-pay--pending" };
}


function EstimatoModal({ bookings, services, dueList, settling, onSettleInstallment, onClose }) {
  const priceMap = useMemo(() => new Map((services || []).map(s => [String(s.serviceId), Number(s.price)])), [services]);

  const active = useMemo(() => (bookings || []).filter(b => b.status !== "CANCELLED"), [bookings]);

  // V62: per-row "total" is the sum of NON-settled lines (incasso ancora da incassare).
  // Settled lines stay visible in the breakdown but greyed and tagged "Pagato"
  // — they just don't contribute to the row total (or the bottom total).
  const rows = useMemo(
    () =>
      active.map(b => {
        // One buildBreakdownItems call per booking — reused for the row display AND
        // the amountDue calc (single source of truth via computeBookingAmountDue).
        const items = buildBreakdownItems(b, priceMap);
        const isBundle = b.customTotalPrice != null;
        const amountDue = computeBookingAmountDue(b, items);
        // Display "Totale" row: bundle → manual bundle price + product rows (products are
        // never folded into the manual price); otherwise = da-incassare.
        const saleGross = items
          .filter(it => it.kind === "sale")
          .reduce((acc, it) => acc + Number(it.price ?? 0), 0);
        const total = isBundle ? Number(b.customTotalPrice) + saleGross : amountDue;
        return { booking: b, pay: getPaymentLabel(b), items, total, amountDue, isBundle };
      }),
    [active, priceMap],
  );

  const totals = useMemo(
    () => ({ total: rows.reduce((acc, r) => acc + (Number.isFinite(r.amountDue) ? r.amountDue : 0), 0) }),
    [rows],
  );

  // Installments due today are surfaced as their own section (and folded into the
  // footer total) — they live outside the per-booking rows above.
  const dueSum = (dueList || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Stop background (Lenis) scroll while open; ref-counted, balanced on abrupt unmount.
  useEffect(() => {
    pushLenisLock();
    return () => popLenisLock();
  }, []);

  return ReactDOM.createPortal(
    <div className="ag-estimato-backdrop" onClick={onClose}>
      <div className="ag-estimato-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Dettaglio Incasso">
        <div className="ag-estimato-header">
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Dettaglio Incasso</h3>
          <button className="ag-estimato-close" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div className="ag-estimato-body" data-lenis-prevent>
          <table className="ag-estimato-table">
            <thead>
              <tr>
                <th>Ora</th>
                <th>Cliente</th>
                <th>Servizio</th>
                <th>Prezzo</th>
                <th>Stato pag.</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap(({ booking: b, pay, items, total, isBundle }) =>
                items
                  .map((it, idx) => (
                    <tr
                      key={`${b.bookingId}-${idx}`}
                      className={`${idx > 0 ? "ag-estimato-row--sub" : ""}${it.paid ? " ag-estimato-row--paid" : ""}`.trim()}
                    >
                      <td>{idx === 0 ? fmtTime(b.startTime) : ""}</td>
                      <td>{idx === 0 ? b.customerName || "—" : ""}</td>
                      <td>
                        <span style={it.paid ? { textDecoration: "line-through", opacity: 0.55 } : undefined}>{it.label}</span>
                        {it.paid && <span className="ag-pill ag-pill--paid" style={{ marginLeft: 8 }}>✓ Pagato</span>}
                      </td>
                      <td
                        className={`ag-estimato-price${it.price == null ? " ag-estimato-price--null" : ""}`}
                        style={it.paid && it.paymentMode !== "INSTALLMENTS" ? { textDecoration: "line-through", opacity: 0.55 } : undefined}
                      >
                        {it.paymentMode === "INSTALLMENTS" ? <span style={{ color: "#8c6d3f" }}>📅 Piano rate</span> : formatEuro(it.price)}
                      </td>
                      <td>
                        {it.paymentMode === "INSTALLMENTS" ? (
                          <InstallmentPlanPill />
                        ) : isBundle ? (
                          // Bundle = one atomic payment unit → a single booking-level badge on row 0.
                          idx === 0 ? (
                            <span className={`ag-pay-badge ${pay.css}`}>
                              {pay.icon} {pay.text}
                            </span>
                          ) : (
                            ""
                          )
                        ) : (
                          // V64 M2b: per-row payment status (was only on idx === 0).
                          <span className={`ag-pill ${it.paid ? "ag-pill--paid" : "ag-pill--unpaid"}`}>
                            {it.paid ? "✓ Pagato" : "⏳ Da pagare"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                  .concat(
                    items.length > 1
                      ? [
                          <tr key={`${b.bookingId}-total`} className="ag-estimato-row--total">
                            <td></td>
                            <td></td>
                            <td style={{ fontWeight: 500, fontStyle: "italic", color: "#888" }}>{isBundle ? "Totale (prezzo bundle)" : "Totale"}</td>
                            <td className="ag-estimato-price" style={{ fontWeight: 600, borderTop: "1px solid #ddd" }}>
                              {formatEuro(total)}
                            </td>
                            <td></td>
                          </tr>,
                        ]
                      : [],
                  ),
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#bbb", padding: "1.5rem" }}>
                    Nessun appuntamento attivo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <InstallmentsDueSection dueList={dueList} settling={settling} onSettle={onSettleInstallment} />
        </div>

        <div className="ag-estimato-footer">
          <div className="ag-estimato-total">Totale stimato (da incassare): {formatEuro(totals.total + dueSum)}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** ---------- Timeline ---------- */
function TimelineDay({ dateISO, data, bookings = [], personalAppts = [], selectedBookingId, onBookingClick, onPersonalApptClick }) {
  const timelineRef = useRef(null);
  const nowLineRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);

  const viewWindow = useMemo(() => {
    // Phase 6c: the timeline must ALWAYS span at least 08:00-20:00 so the
    // admin can place personal appointments anywhere in the day regardless of
    // the salon's actual opening hours that day. May widen past those bounds
    // when openRanges extend earlier or later, but never narrower.
    const MIN_START = 8 * 60;
    const MIN_END = 20 * 60;
    if (!data?.openRanges?.length) return { startMin: MIN_START, endMin: MIN_END };
    const minStart = Math.min(...data.openRanges.map(r => minutes(r.start)));
    const maxEnd = Math.max(...data.openRanges.map(r => minutes(r.end)));
    const startMin = clamp(Math.min(MIN_START, minStart - 30), 0, 24 * 60);
    const endMin = clamp(Math.max(MIN_END, maxEnd + 30), 0, 24 * 60);
    return { startMin, endMin };
  }, [data]);

  const toPct = useCallback(m => ((m - viewWindow.startMin) / (viewWindow.endMin - viewWindow.startMin)) * 100, [viewWindow.endMin, viewWindow.startMin]);

  const timelineHeight = useMemo(() => {
    const totalMin = viewWindow.endMin - viewWindow.startMin;
    return Math.min(900, Math.max(400, Math.round(totalMin * 1.4)));
  }, [viewWindow]);

  // Mappa "HH:mm" → booking per collegare i blocchi timeline alla lista
  const bookingMap = useMemo(() => {
    const m = new Map();
    (bookings || []).forEach(b => {
      const tStart = b.startTime?.slice(11, 16);
      if (tStart) m.set(tStart, b);
    });
    return m;
  }, [bookings]);

  const renderBlock = (slot, kind, idx) => {
    const start = minutes(slot.start);
    const end = minutes(slot.end);
    if (end <= viewWindow.startMin || start >= viewWindow.endMin) return null;
    const top = toPct(Math.max(start, viewWindow.startMin));
    const height = toPct(Math.min(end, viewWindow.endMin)) - top;

    if (kind === "open") {
      return <div key={`open-${idx}`} className="ag-tl-block ag-tl-open" style={{ top: `${top}%`, height: `${Math.max(height, 0)}%` }} />;
    }

    if (kind === "closure") {
      const blockHeight = Math.max(height, 0);
      const showLabel = blockHeight > 3; // hide label on very thin slivers
      const titleText = slot.reason ? `🔒 Chiuso — ${slot.reason}` : "🔒 Chiuso";
      return (
        <div
          key={`closure-${idx}`}
          className="ag-tl-block ag-tl-closure ag-tl-closure-adhoc"
          style={{ top: `${top}%`, height: `${blockHeight}%` }}
          title={titleText}
        >
          {showLabel && (
            <div className="ag-tl-closure__label">
              <span className="ag-tl-closure__icon">🔒</span>
              <span className="ag-tl-closure__text">
                {slot.reason ? `Chiuso · ${slot.reason}` : "Chiuso"}
              </span>
            </div>
          )}
        </div>
      );
    }

    // Booking block — arricchito con dati cliente/servizio
    const booking = bookingMap.get(slot.start);
    const bookingId = booking?.bookingId;
    const isSelected = bookingId != null && bookingId === selectedBookingId;
    // Fix B: usa optionDuration solo per prenotazioni con un singolo servizio
    const hasMultipleServices = Array.isArray(booking?.services) && booking.services.length > 1;
    const effectiveEnd = !hasMultipleServices && booking?.optionDuration != null ? start + booking.optionDuration : end;
    const bookingHeight = toPct(Math.min(effectiveEnd, viewWindow.endMin)) - top;
    const durationMin = effectiveEnd - start;
    const tier = durationMin < 20 ? "tiny" : durationMin < 40 ? "compact" : "full";
    // Phase 6c color key cascade: AdminBookingCardDTO doesn't expose
    // categoryName/category today, which left every block falling through to
    // PALETTE[0] (the "wall of brown"). Cascade through the next-best
    // identifiers so adjacent bookings for different services / packages /
    // custom treatments hash to distinct palette entries.
    const colorKey =
      booking?.categoryName ??
      booking?.category ??
      booking?.linkedPackages?.[0]?.packageName ??
      booking?.linkedPackage?.packageName ??
      booking?.serviceTitle ??
      booking?.customServiceName ??
      booking?.linkedPromotions?.[0]?.title ??
      null;
    const color = categoryColor(colorKey);
    // Subtle secondary signal: package-linked bookings get a slightly thicker
    // left accent so they're identifiable even when their color collides with
    // a plain-service neighbour's hash bucket.
    const isPackageLinked = !!(booking?.linkedPackages?.length || booking?.linkedPackage);
    // Phase 6: timeline blocks are small — surface only the FIRST package's name,
    // its own "S.x/y" badge, and a +N suffix that counts (extra services + extra
    // packages beyond the first). Details live in the appointment list / drawer.
    const pkgList = booking?.linkedPackages?.length
      ? booking.linkedPackages
      : booking?.linkedPackage
        ? [booking.linkedPackage]
        : [];
    const firstPkg = pkgList[0] ?? null;
    const pkgName = firstPkg
      ? firstPkg.packageName || firstPkg.serviceTitle || firstPkg.serviceName || "—"
      : null;
    const extraSvcs = Array.isArray(booking?.services) && booking.services.length > 0 ? booking.services : [];
    const sessionNum = firstPkg?.sessionNumber ?? booking?.currentSession;
    const totalSess = firstPkg?.totalSessions ?? booking?.totalSessions;
    const sessionBadge = sessionNum ? ` S.${sessionNum}${totalSess ? `/${totalSess}` : ""}` : "";
    const extraPkgCount = Math.max(0, pkgList.length - 1);
    const additionalCount = extraSvcs.length + extraPkgCount;
    const baseServiceName = pkgName
      ? `${pkgName}${sessionBadge}${additionalCount > 0 ? ` +${additionalCount}` : ""}`
      : extraSvcs.length > 1
        ? `${extraSvcs[0].name || extraSvcs[0].title || "?"} +${extraSvcs.length - 1}`
        : extraSvcs[0]?.name || extraSvcs[0]?.title || booking?.serviceTitle || booking?.customServiceName || booking?.linkedPromotions?.[0]?.title || "—";
    // Fix C: aggiungi optionName al label (solo se non è già un pacchetto o multi-servizio)
    const serviceName = !pkgName && extraSvcs.length <= 1 && booking?.optionName ? `${baseServiceName} · ${booking.optionName}` : baseServiceName;

    return (
      <div
        key={`${kind}-${idx}`}
        className={`ag-tl-block ag-tl-booking${booking ? " ag-tl-booking--clickable" : ""}${isSelected ? " ag-tl-booking--selected" : ""}`}
        style={{
          top: `${top}%`,
          height: `${Math.max(bookingHeight, 0)}%`,
          background: color.bg,
          borderColor: color.border,
          borderLeft: `${isPackageLinked ? 4 : 3}px solid ${color.border}`,
        }}
        role={booking ? "button" : undefined}
        tabIndex={booking ? 0 : undefined}
        title={booking ? `${booking.serviceTitle || ""} — ${booking.customerName || ""}` : undefined}
        onClick={
          booking
            ? e => {
                e.stopPropagation();
                onBookingClick?.(bookingId);
              }
            : undefined
        }
        onKeyDown={
          booking
            ? e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onBookingClick?.(bookingId);
                }
              }
            : undefined
        }
      >
        {booking && tier === "tiny" && <div className="ag-tl-booking__label ag-tl-booking__label--tiny">{slot.start}</div>}
        {booking && tier === "compact" && (
          <div className="ag-tl-booking__label">
            <div className="ag-tl-booking__customer">
              {shortCustomerName(booking.customerName)}
              {booking.customerVerified && <VerifiedBadge size={12} />}
            </div>
            <div className="ag-tl-booking__service">{serviceName}</div>
          </div>
        )}
        {booking && tier === "full" && (
          <div className="ag-tl-booking__label">
            <div className="ag-tl-booking__service">{serviceName}</div>
            <div className="ag-tl-booking__customer">
              {shortCustomerName(booking.customerName)}
              {booking.customerVerified && <VerifiedBadge />}
              {booking.sessionsRemaining === 1 && (
                <span className="ag-session-pill ag-session-pill--last" style={{ marginLeft: 4 }}>
                  ⚠
                </span>
              )}
              {!booking.createdByAdmin && (
                booking.paidOnline
                  ? (booking.status !== "REFUNDED" && <PaidOnlineBadge />)
                  : <OnlineBadge />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const hourMarks = useMemo(() => {
    const marks = [];
    const startHour = Math.ceil(viewWindow.startMin / 60);
    const endHour = Math.floor(viewWindow.endMin / 60);
    for (let h = startHour; h <= endHour; h++) {
      marks.push({ h, pct: toPct(h * 60) });
    }
    return marks;
  }, [toPct, viewWindow.endMin, viewWindow.startMin]);

  useEffect(() => {
    const timelineEl = timelineRef.current;
    const lineEl = nowLineRef.current;
    if (!timelineEl || !lineEl || !data) return;

    const todayISO = toISODate(new Date());
    const isToday = dateISO === todayISO;

    if (!isToday) {
      lineEl.style.opacity = "0";
      hasAutoScrolledRef.current = false;
      return;
    }

    const updatePosition = () => {
      const rect = timelineEl.getBoundingClientRect();
      const containerHeight = rect.height;
      if (!containerHeight) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const { startMin, endMin } = viewWindow;
      if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return;

      const ratio = (clamp(currentMinutes, startMin, endMin) - startMin) / (endMin - startMin);
      const y = ratio * containerHeight;

      lineEl.style.opacity = "1";
      lineEl.style.transform = `translateY(${y}px)`;

      if (!hasAutoScrolledRef.current) {
        hasAutoScrolledRef.current = true;
        const lineRect = lineEl.getBoundingClientRect();
        const lineCenter = lineRect.top + lineRect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const delta = lineCenter - viewportCenter;
        if (Math.abs(delta) > 16) window.scrollBy({ top: delta, behavior: "smooth" });
      }
    };

    let frameId;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updatePosition);
    };
    scheduleUpdate();
    const intervalId = window.setInterval(scheduleUpdate, 60 * 1000);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", scheduleUpdate);
      cancelAnimationFrame(frameId);
    };
  }, [dateISO, data, viewWindow]);

  if (!data) {
    return (
      <Card className="ag-card">
        <Card.Body className="ag-card__body">
          <div className="d-flex align-items-center gap-2">
            <Spinner size="sm" />
            <span className="text-muted">Caricamento timeline…</span>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="ag-card">
      <Card.Body className="ag-card__body">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="ag-title">Timeline</div>
          <div className="ag-subtitle">{dateISO}</div>
        </div>
        <div ref={timelineRef} className="ag-timeline" style={{ height: timelineHeight }}>
          <div className="ag-timeline__labels">
            {hourMarks.map(m => (
              <div key={m.h} className="ag-hour" style={{ top: `${m.pct}%` }}>
                {pad2(m.h)}:00
              </div>
            ))}
          </div>
          <div className="ag-timeline__col">
            {hourMarks.map(m => (
              <div key={m.h} className="ag-gridline" style={{ top: `${m.pct}%` }} />
            ))}
            {data.openRanges?.map((s, i) => renderBlock(s, "open", i))}
            {data.closureRanges?.map((s, i) => renderBlock(s, "closure", i))}
            {data.bookingRanges?.map((s, i) => renderBlock(s, "booking", i))}
            {personalAppts.map(pa => {
              const startMin = minutes((pa.startTime || "").slice(0, 5));
              const endMin = startMin + (pa.durationMinutes || 30);
              if (endMin <= viewWindow.startMin || startMin >= viewWindow.endMin) return null;
              const top = toPct(Math.max(startMin, viewWindow.startMin));
              const height = toPct(Math.min(endMin, viewWindow.endMin)) - top;
              const isCompact = endMin - startMin < 30;
              return (
                <div
                  key={pa.id}
                  className="ag-tl-block ag-tl-personal"
                  style={{ top: `${top}%`, height: `${Math.max(height, 0)}%` }}
                  role="button"
                  tabIndex={0}
                  title={pa.title}
                  onClick={e => {
                    e.stopPropagation();
                    onPersonalApptClick?.(pa);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPersonalApptClick?.(pa);
                    }
                  }}
                >
                  {isCompact ? (
                    <div className="ag-tl-booking__label ag-tl-booking__label--compact">
                      <span className="ag-tl-booking__service">{pa.title}</span>
                    </div>
                  ) : (
                    <div className="ag-tl-booking__label">
                      <div className="ag-tl-booking__service">{pa.title}</div>
                      <div className="ag-tl-booking__customer">
                        {(pa.startTime || "").slice(0, 5)} · {pa.durationMinutes}′
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={nowLineRef} className="ag-nowline" aria-hidden="true" />
          </div>
        </div>
        <div className="ag-legend">
          <span className="ag-dot ag-dot--open" /> Open
          <span className="ag-dot ag-dot--closure" /> Chiusure
          <span className="ag-dot ag-dot--booking" /> Prenotazioni (colore = categoria)
          <span className="ag-dot ag-dot--personal" /> Personali
        </div>
      </Card.Body>
    </Card>
  );
}

/** ---------- Pagina ---------- */
export default function AdminAgendaPage() {
  const [date, setDate] = useState(() => new Date());

  // ── Compact layout (≤1279px): single-column tablet/laptop mode ───────────
  const [isCompact, setIsCompact] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1279.98px)").matches);
  const [compactTab, setCompactTab] = useState("appointments"); // 'appointments' | 'timeline' | 'week'

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1279.98px)");
    const sync = () => setIsCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const dateISO = useMemo(() => toISODate(date), [date]);

  const [timeline, setTimeline] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [personalAppts, setPersonalAppts] = useState([]);

  const [err, setErr] = useState("");
  const [errDetails, setErrDetails] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [services, setServices] = useState([]);
  const [servicesErr, setServicesErr] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selected, setSelected] = useState(null);

  // New multi-service appointment drawer (separate from the existing BookingModal)
  const [newDrawerOpen, setNewDrawerOpen] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);

  // Per-(booking, package) expansion state for the package items collapsible
  // inside the agenda card. Phase 6: with N packages per booking the key must
  // identify BOTH the booking and the specific package — using just bookingId
  // would mean all N packages on one card share a single collapse state.
  // The chevron handlers stop propagation so the booking card never opens the
  // edit drawer in the process.
  const [expandedAgendaPkgs, setExpandedAgendaPkgs] = useState(() => new Set());
  const agendaPkgKey = (bookingId, pkgAssignmentId) => `${bookingId}::${pkgAssignmentId ?? "first"}`;
  const toggleAgendaPkg = useCallback((bookingId, pkgAssignmentId) => {
    const key = agendaPkgKey(bookingId, pkgAssignmentId);
    setExpandedAgendaPkgs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Arretrati in agenda (Fase 2): reuse the SAME expand mechanism as packages
  // (expandedAgendaPkgs + agendaPkgKey + toggleAgendaPkg) with the sentinel key
  // agendaPkgKey(bookingId, "arretrati"). The list is lazy-loaded on open via the GET. ──
  const [arretratiData, setArretratiData] = useState({}); // bookingId -> { loading, error, items }
  const [arretratoSettling, setArretratoSettling] = useState(null); // row key in-flight (double-click guard)
  const [arretratoError, setArretratoError] = useState(null);       // row key whose settle failed
  const [confirmArretrato, setConfirmArretrato] = useState(null);   // { card, a } awaiting confirm

  const arretratoRowKey = a => `${a.bookingId}-${a.kind}-${a.refId ?? "x"}`;

  const loadArretrati = useCallback(async bookingId => {
    setArretratiData(prev => ({ ...prev, [bookingId]: { loading: true, error: null, items: prev[bookingId]?.items ?? [] } }));
    try {
      const items = await fetchArretratiForBooking(bookingId);
      setArretratiData(prev => ({ ...prev, [bookingId]: { loading: false, error: null, items } }));
      return items;
    } catch (e) {
      setArretratiData(prev => ({ ...prev, [bookingId]: { loading: false, error: e.message || "Errore caricamento arretrati.", items: [] } }));
      return null;
    }
  }, []);

  // Settle ONE arretrato row from the dropdown. Reuses settleBookingLines +
  // buildArretratoSettlePayload (alsoComplete:false) exactly like ClientiPage (Fase 1).
  // On success: re-fetch the dropdown; if the customer has NO more arretrati, drop the
  // badge on EVERY card of the same customer (matched by normalized phone). On error:
  // keep the row ("Riprova"), badge unchanged.
  const settleArretrato = useCallback(async (card, a) => {
    const rowKey = arretratoRowKey(a);
    if (arretratoSettling) return; // a settle is already in flight — ignore (double-click guard)
    setArretratoError(null);
    setArretratoSettling(rowKey);
    try {
      await settleBookingLines(a.bookingId, buildArretratoSettlePayload(a));
      const items = await loadArretrati(card.bookingId);
      if (items && items.length === 0) {
        setBookings(prev => prev.map(bk =>
          digitsOnly(bk.customerPhone) === digitsOnly(card.customerPhone)
            ? { ...bk, hasOutstanding: false }
            : bk));
      }
    } catch {
      setArretratoError(rowKey); // network/settle error → keep the row, surface "Riprova"
    } finally {
      setArretratoSettling(null);
    }
  }, [arretratoSettling, loadArretrati]);

  const [viewMode, setViewMode] = useState("day");
  const [weekRefreshKey, setWeekRefreshKey] = useState(0);
  const [confirmModal, setConfirmModal] = useState(null);
  const [completedUndo, setCompletedUndo] = useState({});
  const [closuresDrawerOpen, setClosuresDrawerOpen] = useState(false);
  const [closures, setClosures] = useState([]);
  const [paddingEditing, setPaddingEditing] = useState(null); // bookingId in edit
  const [paddingSaving, setPaddingSaving] = useState(null); // bookingId in saving
  const [paddingDraft, setPaddingDraft] = useState(0); // valore locale mentre si edita
  const [nextSlotDuration, setNextSlotDuration] = useState(60);
  const [nextSlotResult, setNextSlotResult] = useState(null);
  const [nextSlotLoading, setNextSlotLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const deleteIntervalRef = useRef(null);
  const [refundConfirmBooking, setRefundConfirmBooking] = useState(null);
  const [consentConfirmBooking, setConsentConfirmBooking] = useState(null);
  const [showEstimatoModal, setShowEstimatoModal] = useState(false);
  const [completionDrawer, setCompletionDrawer] = useState(null); // { booking, items } | null

  // ── WhatsApp reminders ───────────────────────────────────────────────
  // Stato "inviato" = booking.reminderSentAt dal backend.
  // reminderPending = solo client: cliccato ma non ancora confermato.
  const [reminderPending, setReminderPending] = useState(() => new Set());
  const [reminderBusy, setReminderBusy] = useState(() => new Set());

  // ── Timeline ↔ Lista: highlight sincronizzato ────────────────────────────
  const [highlightedId, setHighlightedId] = useState(null);
  const itemRefsMap = useRef(new Map());

  const handleTimelineBookingClick = useCallback(bookingId => {
    setHighlightedId(prev => (prev === bookingId ? null : bookingId));
    const el = itemRefsMap.current.get(bookingId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // In compact mode the appointments list lives in another tab,
  // so a timeline-block click opens the booking's edit drawer instead.
  const handleCompactTimelineBookingClick = useCallback(
    bookingId => {
      const booking = bookings.find(b => b.bookingId === bookingId);
      if (booking) {
        setEditingBooking(booking);
        setNewDrawerOpen(true);
      }
    },
    [bookings],
  );

  // Azzera highlight al click fuori da blocchi timeline e lista
  useEffect(() => {
    if (!highlightedId) return;
    const onDoc = e => {
      if (!e.target.closest(".ag-tl-booking") && !e.target.closest(".ag-item")) {
        setHighlightedId(null);
      }
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [highlightedId]);

  // FIX B2: traccia se il cambio data è stato causato da una ricerca slot.
  // Senza questo ref, l'effect su dateISO azzera nextSlotResult appena
  // la ricerca cambia la data, rendendo "Ancora →" inutilizzabile.
  const dateChangedBySearchRef = useRef(false);

  const dayStrip = useMemo(() => {
    const base = fromISODateLocal(dateISO);
    const out = [];
    for (let i = -3; i <= 3; i++) out.push(addDays(base, i));
    return out;
  }, [dateISO]);

  // ── Closures fetch covers both the ±3-day strip and the Mon-Sun week view ──
  const closuresVisibleRange = useMemo(() => {
    const base = fromISODateLocal(dateISO);
    const stripStart = addDays(base, -3);
    const stripEnd   = addDays(base, 3);
    // Monday of the week containing base
    const weekStart  = (() => {
      const d = new Date(base);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const weekEnd = addDays(weekStart, 6);
    const from = stripStart < weekStart ? stripStart : weekStart;
    const toIncl = stripEnd > weekEnd ? stripEnd : weekEnd;
    return { from: toISODate(from), to: toISODate(addDays(toIncl, 1)) };
  }, [dateISO]);

  const refreshClosures = useCallback(async () => {
    try {
      const data = await getClosuresRange(closuresVisibleRange.from, closuresVisibleRange.to);
      setClosures(Array.isArray(data) ? data : []);
    } catch {
      // Non-fatal: closure indicators degrade silently.
      setClosures([]);
    }
  }, [closuresVisibleRange.from, closuresVisibleRange.to]);

  useEffect(() => {
    refreshClosures();
  }, [refreshClosures]);

  // Day-chip "is-closed" indicator: only full-day closures shade a day.
  const closedDatesSet = useMemo(() => {
    const s = new Set();
    for (const c of closures) {
      if (!c.fullDay) continue;
      const sd = c.startDate || c.date;
      const ed = c.endDate || sd;
      if (!sd) continue;
      let cursor = fromISODateLocal(sd);
      const endD = fromISODateLocal(ed);
      while (cursor <= endD) {
        s.add(toISODate(cursor));
        cursor = addDays(cursor, 1);
      }
    }
    return s;
  }, [closures]);

  const loadServices = useCallback(async () => {
    setServicesErr("");
    try {
      const list = await fetchServices();
      const arr = Array.isArray(list) ? list : (list?.content ?? []);
      const norm = arr
        .map(s => ({
          serviceId: s.serviceId ?? s.id,
          title: s.title ?? s.name,
          durationMin: s.durationMin ?? s.duration ?? s.minutes,
          price: s.price ?? s.cost ?? null,
          options: s.options ?? s.serviceOptions ?? s.serviceOptionList ?? [],
        }))
        .filter(s => s.serviceId);
      setServices(norm);
    } catch (e) {
      setServicesErr(e.message);
    }
  }, []);

  // Installment surfacing (Phase 2b-fe). The hook owns the due-feed fetch, the
  // dueByPackage map, the KPI total, and the settle action. Declared BEFORE refresh
  // so reloadInstallments is in scope for refresh's dependency array.
  const {
    dueByPackage,
    dueList,
    dueTotal,
    hasDue,
    settling: installmentSettling,
    reload: reloadInstallments,
    requestSettle: requestSettleInstallment,
    confirmProps: installmentConfirmProps,
  } = useInstallmentsDue(dateISO, { onError: setErr });

  const refresh = useCallback(async () => {
    setErr("");
    setErrDetails(null);
    setLoading(true);
    try {
      const [tl, bk, pa] = await Promise.all([getTimelineDay(dateISO), getBookingsDay(dateISO), getPersonalAppointmentsDay(dateISO)]);
      setTimeline(tl);
      const sorted = (bk || []).slice().sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setBookings(sorted);
      setPersonalAppts(pa || []);
      reloadInstallments();
    } catch (e) {
      setErr(e.message || "Errore nel caricamento agenda.");
    } finally {
      setLoading(false);
    }
  }, [dateISO, reloadInstallments]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    let result = bookings;
    const needle = q.trim().toLowerCase();
    if (needle) {
      result = result.filter(b => {
        const hay = [b.customerName, b.customerPhone, b.customerEmail, b.serviceTitle, b.optionName, b.status].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(needle);
      });
    }
    if (statusFilter.size > 0) {
      result = result.filter(b => {
        const s = b.status;
        if (statusFilter.has("PENDING") && (s === "PENDING" || s === "PENDING_PAYMENT")) return true;
        if (statusFilter.has("CONFIRMED") && s === "CONFIRMED") return true;
        if (statusFilter.has("COMPLETED") && s === "COMPLETED") return true;
        if (statusFilter.has("CANCELLED") && s === "CANCELLED") return true;
        return false;
      });
    }
    return result;
  }, [bookings, q, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    bookings.forEach(b => {
      const s = b.status;
      if (s === "PENDING" || s === "PENDING_PAYMENT") counts.pending += 1;
      else if (s === "CONFIRMED") counts.confirmed += 1;
      else if (s === "COMPLETED") counts.completed += 1;
      else if (s === "CANCELLED") counts.cancelled += 1;
    });
    return counts;
  }, [bookings]);

  // Per ogni booking calcola il gap massimo disponibile prima del prossimo appuntamento
  const paddingMaxMap = useMemo(() => {
    const map = new Map();
    const active = filtered.filter(b => b.status !== "CANCELLED");
    active.forEach((b, i) => {
      const nextActive = active.find((nb, ni) => ni > i && nb.status !== "CANCELLED");
      if (nextActive) {
        const gap = Math.floor((new Date(nextActive.startTime) - new Date(b.endTime)) / 60000);
        map.set(b.bookingId, Math.max(0, gap));
      } else {
        map.set(b.bookingId, 120); // nessun booking dopo: max 120 min
      }
    });
    return map;
  }, [filtered]);

  const agendaBusyDates = useMemo(() => {
    const m = new Map();
    bookings.forEach(b => {
      const iso = typeof b.startTime === "string" ? b.startTime.slice(0, 10) : "";
      if (!iso) return;
      m.set(iso, (m.get(iso) || 0) + 1);
    });
    return Array.from(m.entries()).map(([date, count]) => ({ date, count }));
  }, [bookings]);

  const kpi = useMemo(() => {
    const active = bookings.filter(b => b.status !== "CANCELLED");
    const count = active.length;
    const bookedMin = active.reduce((sum, b) => {
      const s = new Date(b.startTime).getTime();
      const e = new Date(b.endTime).getTime();
      return sum + Math.max(0, Math.round((e - s) / 60000));
    }, 0);
    const openMin = (timeline?.openRanges || []).reduce((sum, r) => sum + Math.max(0, minutes(r.end) - minutes(r.start)), 0);
    const occ = openMin > 0 ? Math.round((bookedMin / openMin) * 100) : 0;
    const priceMap = new Map(services.map(s => [String(s.serviceId), Number(s.price)]));
    // V64: per-booking "da incassare" — single source of truth (computeBookingAmountDue),
    // identical to the EstimatoModal. Respects bundle customTotalPrice; paidOnline /
    // PackageCredit and per-line paid flags are folded into it.paid via isLineSettled.
    const dueOf = b => computeBookingAmountDue(b, buildBreakdownItems(b, priceMap));
    const revenueKnown = active.some(b => Number.isFinite(dueOf(b)));
    const incassoStimato = active.reduce((sum, b) => {
      const p = dueOf(b);
      return sum + (Number.isFinite(p) ? p : 0);
    }, 0);
    // Installments due on the viewed day add to the estimate; their presence alone
    // makes revenue "known" even on a day with no priced appointments.
    return {
      count, bookedMin, openMin, occ,
      incassoStimato: incassoStimato + dueTotal,
      revenueKnown: revenueKnown || hasDue,
    };
  }, [bookings, timeline, services, dueTotal, hasDue]);

  // Catalog price map (serviceId → price), shared by the "Completa" smart-skip and
  // the CompletionDrawer. Only affects displayed prices: the settle payload and the
  // paid/branch logic are price-independent (it.paid comes from isLineSettled).
  const priceMap = useMemo(() => new Map(services.map(s => [String(s.serviceId), Number(s.price)])), [services]);

  // FIX B2: azzerare nextSlotResult solo se il cambio data è stato manuale,
  // NON se è stato causato da searchNextSlot (altrimenti "Ancora →" si rompe)
  useEffect(() => {
    setStatusFilter(new Set());
    setHighlightedId(null);
    itemRefsMap.current.clear();
    if (dateChangedBySearchRef.current) {
      dateChangedBySearchRef.current = false;
      // Data cambiata da ricerca slot: NON azzeriamo il risultato
    } else {
      // Data cambiata manualmente: azzeriamo
      setNextSlotResult(null);
    }
  }, [dateISO]);

  const openCreate = () => {
    setEditingBooking(null);
    setNewDrawerOpen(true);
  };

  const openEdit = b => {
    setEditingBooking(b);
    setNewDrawerOpen(true);
  };

  const changeStatus = async (id, status) => {
    setErr("");
    setErrDetails(null);
    try {
      await patchBookingStatus(id, status);
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  };

  // ── "Completa" → smart-skip a 4 rami, single code-path su /settle ───────────
  // La DATA non influenza la logica: un CONFIRMED nel passato (Michela completa in
  // ritardo) apre il drawer normalmente. Conta solo lo stato + i flag paid.
  // Rami diretti (1 paidOnline, 2 tutte già pagate): mappe vuote → il backend non
  // flippa alcun flag, esegue solo la transizione a COMPLETED.
  // completedUndo[bookingId] = { prevStatus, paidSnapshot } → snapshot dei flag paid
  // PRE-completamento, per l'undo simmetrico (vedi bottone "Annulla completamento").
  const settleAndComplete = async (b, items) => {
    const undo = { prevStatus: b.status, paidSnapshot: buildSnapshotPayload(b, items) };
    setErr("");
    setErrDetails(null);
    try {
      await settleBookingLines(b.bookingId, { servicePaid: {}, packageSessionPaid: {}, alsoComplete: true });
      setCompletedUndo(u => ({ ...u, [b.bookingId]: undo }));
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleCompleteClick = b => {
    const items = buildBreakdownItems(b, priceMap);
    if (b.paidOnline) return settleAndComplete(b, items);                              // 1
    if (b.customTotalPrice != null) return setCompletionDrawer({ booking: b, items }); // 3 (bundle prima di "tutte pagate")
    if (items.every(it => it.paid)) return settleAndComplete(b, items);                // 2
    setCompletionDrawer({ booking: b, items });                                        // 4
  };

  const handleDrawerConfirm = async payload => {
    if (!completionDrawer) return;
    const b = completionDrawer.booking;
    const undo = { prevStatus: b.status, paidSnapshot: buildSnapshotPayload(b, completionDrawer.items) };
    setErr("");
    setErrDetails(null);
    try {
      await settleBookingLines(b.bookingId, payload);
      setCompletedUndo(u => ({ ...u, [b.bookingId]: undo }));
      setCompletionDrawer(null);
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  };

  // Undo simmetrico: ripristina PRIMA i flag paid pre-completamento (settle senza
  // completare), POI lo stato a CONFIRMED (+ ripristino seduta via /status). Se la
  // prima fallisce, lo stato resta COMPLETED e l'entry undo è conservata (retry).
  const undoCompletion = async b => {
    const undo = completedUndo[b.bookingId];
    if (!undo) return;
    setErr("");
    setErrDetails(null);
    try {
      if (undo.paidSnapshot) {
        await settleBookingLines(b.bookingId, { ...undo.paidSnapshot, alsoComplete: false });
      }
      await patchBookingStatus(b.bookingId, undo.prevStatus || "CONFIRMED");
      setCompletedUndo(u => {
        const n = { ...u };
        delete n[b.bookingId];
        return n;
      });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  };

  const savePadding = async (bookingId, minutes) => {
    setPaddingSaving(bookingId);
    try {
      await patchBookingPadding(bookingId, minutes);
      await refresh();
      setPaddingEditing(null);
    } catch (e) {
      setErr(e.message || "Errore aggiornamento buffer.");
    } finally {
      setPaddingSaving(null);
    }
  };

  const removeBooking = booking => {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
      deleteBooking(pendingDelete.booking.bookingId).catch(() => {});
      setPendingDelete(null);
      setDeleteCountdown(5);
    }

    setBookings(prev => prev.filter(b => b.bookingId !== booking.bookingId));
    setConfirmModal(null);
    setDeleteCountdown(5);

    if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
    deleteIntervalRef.current = setInterval(() => {
      setDeleteCountdown(prev => {
        if (prev <= 1) {
          clearInterval(deleteIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timer = setTimeout(async () => {
      if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
      setPendingDelete(null);
      setErr("");
      setErrDetails(null);
      try {
        await deleteBooking(booking.bookingId);
        await refresh();
      } catch (e) {
        setBookings(prev => [...prev, booking].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
        setErr(e?.normalized?.message || e.message || "Errore durante l'eliminazione.");
        setErrDetails(e?.normalized || null);
      } finally {
        setDeleteCountdown(5);
      }
    }, 5000);

    setPendingDelete({ booking, timer });
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
    setBookings(prev => [...prev, pendingDelete.booking].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
    setPendingDelete(null);
    setDeleteCountdown(5);
  };

  const askDelete = b => {
    setConfirmModal({
      type: "delete",
      booking: b,
      bookingId: b.bookingId,
      customerName: b.customerName,
      stripeSessionId: b.stripeSessionId ?? null,
    });
  };

  const askCancel = b => {
    if (b?.stripeSessionId) {
      setErr("Questa prenotazione è stata pagata. Usa 'Rimborsa' per cancellarla e rimborsare il cliente.");
      setErrDetails(null);
      return;
    }
    setConfirmModal({ type: "cancel", bookingId: b.bookingId, customerName: b.customerName });
  };

  const handleRefund = booking => {
    setRefundConfirmBooking(booking);
  };

  const executeRefund = async () => {
    const booking = refundConfirmBooking;
    setRefundConfirmBooking(null);
    setErr("");
    setErrDetails(null);
    setSuccessMsg("");
    try {
      await refundBooking(booking.bookingId);
      setSuccessMsg("Rimborso avviato con successo");
      setBookings(prev => prev.map(bk => (bk.bookingId === booking.bookingId ? { ...bk, status: "REFUNDED", refundable: false } : bk)));
      if (viewMode === "week") setWeekRefreshKey(k => k + 1);
    } catch (e) {
      setErr(e.message || "Errore durante il rimborso.");
    }
  };

  const signConsent = b => {
    setConsentConfirmBooking(b);
  };

  const executeSignConsent = async () => {
    const b = consentConfirmBooking;
    setConsentConfirmBooking(null);
    try {
      const updated = await patchBookingConsent(b.bookingId);
      setBookings(prev =>
        prev.map(booking =>
          booking.bookingId === b.bookingId ? { ...booking, consentSigned: updated.consentSigned, consentSignedAt: updated.consentSignedAt } : booking,
        ),
      );
      setSuccessMsg("✅ Consenso PMU registrato");
    } catch (e) {
      setErr(e.message || "Errore durante la firma del consenso.");
    }
  };

  const openReminderWhatsApp = b => {
    window.open(buildWhatsAppUrl(b.customerPhone, buildReminderMessage(b)), "_blank", "noopener,noreferrer");
  };

  const handleSendReminder = b => {
    openReminderWhatsApp(b);
    setReminderPending(prev => new Set(prev).add(b.bookingId));
  };

  const dismissReminderPending = bookingId => {
    setReminderPending(prev => {
      const next = new Set(prev);
      next.delete(bookingId);
      return next;
    });
  };

  const setReminderState = async (b, sent) => {
    setReminderBusy(prev => new Set(prev).add(b.bookingId));
    setErr("");
    try {
      const res = await patchBookingReminder(b.bookingId, sent);
      setBookings(prev =>
        prev.map(bk => (bk.bookingId === b.bookingId ? { ...bk, reminderSentAt: res.reminderSentAt } : bk)),
      );
      setReminderPending(prev => {
        const next = new Set(prev);
        next.delete(b.bookingId);
        return next;
      });
    } catch (e) {
      setErr(e.message || "Errore durante l'aggiornamento del promemoria.");
    } finally {
      setReminderBusy(prev => {
        const next = new Set(prev);
        next.delete(b.bookingId);
        return next;
      });
    }
  };

  const confirmReminderSent = b => setReminderState(b, true);
  const undoReminderSent = b => setReminderState(b, false);

  const submitModal = async payload => {
    setErr("");
    setErrDetails(null);
    try {
      if (modalMode === "edit" && selected?.bookingId) {
        await updateBooking(selected.bookingId, payload);
      } else {
        await createAdminBooking(payload);
      }
      setModalOpen(false);
      setSelected(null);
      await refresh();
      if (viewMode === "week") setWeekRefreshKey(k => k + 1);
    } catch (e) {
      console.error("SAVE BOOKING ERROR:", e);
      setErr(e.message || "Errore salvataggio appuntamento.");
    }
  };

  const handleWeekBookingClick = booking => {
    setEditingBooking(booking);
    setNewDrawerOpen(true);
  };
  const handleWeekDayClick = iso => {
    setDate(fromISODateLocal(iso));
    setViewMode("day");
  };
  const handleSlotClick = (iso, hour) => {
    setEditingBooking(null);
    setNewDrawerOpen(true);
  };

  const toggleStatus = key => {
    setStatusFilter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const clearStatusFilters = () => setStatusFilter(new Set());
  const hasStatusFilter = statusFilter.size > 0;

  // FIX B2: imposta il ref PRIMA di cambiare la data
  const searchNextSlot = async (afterISO = null) => {
    setNextSlotLoading(true);
    setNextSlotResult(null);
    try {
      const res = await getNextAvailableSlot(nextSlotDuration, afterISO);
      setNextSlotResult(res);
      if (res?.found && res.slot?.date) {
        dateChangedBySearchRef.current = true; // ← FIX B2: segnala che il cambio data è nostro
        setDate(fromISODateLocal(res.slot.date));
        setViewMode("day");
      }
    } catch (e) {
      setNextSlotResult({ found: false, error: e.message });
    } finally {
      setNextSlotLoading(false);
    }
  };

  const searchNextSlotAgain = () => {
    if (!nextSlotResult?.found || !nextSlotResult.slot) return;
    const { date: slotDate, slotEnd } = nextSlotResult.slot;
    if (!slotDate || !slotEnd) return;
    searchNextSlot(`${slotDate}T${slotEnd.slice(0, 5)}:00`);
  };

  useEffect(() => {
    return () => {
      if (pendingDelete?.timer) clearTimeout(pendingDelete.timer);
      if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
    };
  }, [pendingDelete]);

  return (
    <Container fluid className={`ag-page py-3${isCompact ? " ag-page--has-compact" : ""}`}>
      <SEO title="Agenda" noindex={true} />

      {/* ── Compact sticky header (≤1279px only — hidden on desktop by CSS) ── */}
      {isCompact && (
        <div className="ag-compact-header">
          <div className="ag-compact-header__row ag-compact-header__row--days">
            <div className="ag-strip">
              <button className="ag-iconbtn" onClick={() => setDate(d => addDays(d, -7))} title="Settimana precedente" type="button">
                ‹
              </button>
              <div className="ag-strip__days">
                {dayStrip.map(d => {
                  const iso = toISODate(d);
                  const isActive = iso === dateISO;
                  const isClosed = closedDatesSet.has(iso);
                  const dow = d.toLocaleDateString("it-IT", { weekday: "short" });
                  return (
                    <button
                      key={iso}
                      className={`ag-daychip ${isActive ? "is-active" : ""}${isClosed ? " is-closed" : ""}`}
                      onClick={() => setDate(d)}
                      type="button"
                      title={isClosed ? "Chiuso" : undefined}
                    >
                      <span className="ag-daychip__dow">{dow}</span>
                      <span className="ag-daychip__dd">{d.getDate()}</span>
                      {isClosed && <span className="ag-daychip__lock" aria-hidden="true">🔒</span>}
                    </button>
                  );
                })}
              </div>
              <button className="ag-iconbtn" onClick={() => setDate(d => addDays(d, 7))} title="Settimana successiva" type="button">
                ›
              </button>
            </div>
            <div className="ag-compact-header__quickactions">
              <Button className="ag-btn ag-btn--ghost" size="sm" onClick={() => setDate(new Date())}>
                Oggi
              </Button>
              <DateTimeField
                mode="date"
                value={dateISO}
                onChange={iso => setDate(fromISODateLocal(iso))}
                busyDates={agendaBusyDates}
                placeholder="📅"
                className="ag-date-dtf"
              />
            </div>
          </div>

          <div className="ag-compact-kpi">
            <span className="ag-compact-kpi__item">
              <span className="ag-compact-kpi__value">{kpi.count}</span>
              <span className="ag-compact-kpi__label">{kpi.count === 1 ? "appuntamento" : "appuntamenti"}</span>
            </span>
            <span className="ag-compact-kpi__item">
              <span className="ag-compact-kpi__value">{formatDuration(kpi.bookedMin)}</span>
              <span className="ag-compact-kpi__label">prenotati</span>
            </span>
            <span className="ag-compact-kpi__item">
              <span className="ag-compact-kpi__value">{kpi.openMin ? `${kpi.occ}%` : "—"}</span>
              <span className="ag-compact-kpi__label">occupazione</span>
            </span>
            <span
              className={`ag-compact-kpi__item${kpi.revenueKnown ? " ag-compact-kpi__item--clickable" : ""}`}
              onClick={() => kpi.revenueKnown && setShowEstimatoModal(true)}
              title={kpi.revenueKnown ? "Dettaglio incasso" : undefined}
            >
              <span className="ag-compact-kpi__value">{kpi.revenueKnown ? formatEuro(kpi.incassoStimato) : "—"}</span>
              <span className="ag-compact-kpi__label">incasso</span>
            </span>
            {kpi.openMin > 0 && (
              <>
                <span className="ag-compact-kpi__item">
                  {kpi.occ >= 85 ? (
                    <span className="ag-day-full">🔴 Piena</span>
                  ) : kpi.occ >= 60 ? (
                    <span className="ag-day-busy">🟡 Intensa</span>
                  ) : (
                    <span className="ag-day-free">🟢 Libera</span>
                  )}
                </span>
              </>
            )}
          </div>

          <div className="ag-compact-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={compactTab === "appointments"}
              className={`ag-compact-tab${compactTab === "appointments" ? " is-active" : ""}`}
              onClick={() => setCompactTab("appointments")}
            >
              Appuntamenti
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={compactTab === "timeline"}
              className={`ag-compact-tab${compactTab === "timeline" ? " is-active" : ""}`}
              onClick={() => setCompactTab("timeline")}
            >
              Timeline
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={compactTab === "week"}
              className={`ag-compact-tab${compactTab === "week" ? " is-active" : ""}`}
              onClick={() => setCompactTab("week")}
            >
              Settimana
            </button>
          </div>
        </div>
      )}

      <Row className="g-3 align-items-stretch">
        {/* LEFT */}
        <Col lg={4}>
          <Card className="ag-card">
            <Card.Body className="ag-card__body">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <div>
                    <div className="ag-title">Agenda</div>
                    <div className="ag-subtitle">Gestione appuntamenti</div>
                  </div>
                  <div className="ag-view-toggle">
                    <button type="button" className={`ag-view-toggle__btn ${viewMode === "day" ? "is-active" : ""}`} onClick={() => setViewMode("day")}>
                      Giorno
                    </button>
                    <button type="button" className={`ag-view-toggle__btn ${viewMode === "week" ? "is-active" : ""}`} onClick={() => setViewMode("week")}>
                      Settimana
                    </button>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    className="ag-btn ag-btn--ghost"
                    onClick={() => setClosuresDrawerOpen(true)}
                  >
                    🔒 Chiusure
                  </Button>
                  <Button
                    className="ag-btn ag-btn--primary"
                    onClick={() => {
                      setEditingPersonal(null);
                      setNewDrawerOpen(true);
                    }}
                  >
                    + Nuovo
                  </Button>
                </div>
              </div>

              <div className="ag-strip mt-3">
                <button className="ag-iconbtn" onClick={() => setDate(d => addDays(d, -7))} title="Settimana precedente">
                  ‹
                </button>
                <div className="ag-strip__days">
                  {dayStrip.map(d => {
                    const iso = toISODate(d);
                    const isActive = iso === dateISO;
                    const isClosed = closedDatesSet.has(iso);
                    const dow = d.toLocaleDateString("it-IT", { weekday: "short" });
                    return (
                      <button
                        key={iso}
                        className={`ag-daychip ${isActive ? "is-active" : ""}${isClosed ? " is-closed" : ""}`}
                        onClick={() => setDate(d)}
                        type="button"
                        title={isClosed ? "Chiuso" : undefined}
                      >
                        <span className="ag-daychip__dow">{dow}</span>
                        <span className="ag-daychip__dd">{d.getDate()}</span>
                        {isClosed && <span className="ag-daychip__lock" aria-hidden="true">🔒</span>}
                      </button>
                    );
                  })}
                </div>
                <button className="ag-iconbtn" onClick={() => setDate(d => addDays(d, 7))} title="Settimana successiva">
                  ›
                </button>
              </div>

              <div className="ag-toolbar-nav mt-3">
                <div className="ag-toolbar-nav__btns">
                  <Button className="ag-btn ag-btn--ghost" size="sm" onClick={() => setDate(new Date())}>
                    Oggi
                  </Button>
                </div>
                <div className="ag-date-wrap">
                  <DateTimeField
                    mode="date"
                    value={dateISO}
                    onChange={iso => setDate(fromISODateLocal(iso))}
                    busyDates={agendaBusyDates}
                    placeholder="Vai a data…"
                    className="ag-date-dtf"
                  />
                </div>
              </div>

              <div className="ag-nextslot mt-3">
                <div className="ag-nextslot__row">
                  <div className="ag-nextslot__chips">
                    {[30, 45, 60, 90, 120].map(m => (
                      <button
                        key={m}
                        type="button"
                        className={`ag-nextslot__chip ${nextSlotDuration === m ? "is-active" : ""}`}
                        onClick={() => {
                          setNextSlotDuration(m);
                          setNextSlotResult(null);
                        }}
                      >
                        {m < 60 ? `${m}′` : m === 60 ? "1h" : m === 90 ? "1h30′" : "2h"}
                      </button>
                    ))}
                    <input
                      type="number"
                      className="ag-nextslot__custom"
                      min={15}
                      max={480}
                      step={5}
                      value={![30, 45, 60, 90, 120].includes(nextSlotDuration) ? nextSlotDuration : ""}
                      placeholder="…′"
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v) && v >= 15 && v <= 480) {
                          setNextSlotDuration(v);
                          setNextSlotResult(null);
                        }
                      }}
                    />
                  </div>
                  <button type="button" className="ag-btn ag-btn--soft ag-nextslot__search" disabled={nextSlotLoading} onClick={() => searchNextSlot(null)}>
                    {nextSlotLoading ? "…" : "🔍 Prossima"}
                  </button>
                </div>

                {nextSlotResult && (
                  <div className={`ag-nextslot__result ${nextSlotResult.found ? "ag-nextslot__result--found" : "ag-nextslot__result--none"}`}>
                    {nextSlotResult.found && nextSlotResult.slot ? (
                      <>
                        <span className="ag-nextslot__result-text">
                          📅 <b>{new Date(nextSlotResult.slot.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</b>
                          {" dalle "}
                          <b>{nextSlotResult.slot.slotStart?.slice(0, 5)}</b>
                          {" – "}
                          <span className="ag-nextslot__avail">{nextSlotResult.slot.availableMin} min liberi</span>
                        </span>
                        {/* FIX B2: "Ancora →" ora funziona perché dateChangedBySearchRef
                            impedisce il reset di nextSlotResult quando cambia dateISO */}
                        <button type="button" className="ag-btn ag-btn--ghost ag-nextslot__more" disabled={nextSlotLoading} onClick={searchNextSlotAgain}>
                          Ancora →
                        </button>
                        <button
                          type="button"
                          className="ag-btn ag-btn--primary ag-nextslot__more"
                          onClick={() => {
                            setEditingBooking(null);
                            setNewDrawerOpen(true);
                          }}
                        >
                          📅 Prenota
                        </button>
                      </>
                    ) : (
                      <span className="ag-nextslot__result-text ag-muted">{nextSlotResult.error || "Nessuno slot disponibile nei prossimi 90 giorni."}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="ag-kpi mt-3">
                <div className="ag-kpi__item">
                  <div className="ag-kpi__label">Appuntamenti</div>
                  <div className="ag-kpi__value">{kpi.count}</div>
                </div>
                <div className="ag-kpi__item">
                  <div className="ag-kpi__label">Tempo prenotato</div>
                  <div className="ag-kpi__value">{formatDuration(kpi.bookedMin)}</div>
                </div>
                <div className="ag-kpi__item">
                  <div className="ag-kpi__label">Occupazione</div>
                  <div className="ag-kpi__value">{kpi.openMin ? `${kpi.occ}%` : "—"}</div>
                </div>
                <div
                  className="ag-kpi__item"
                  onClick={() => kpi.revenueKnown && setShowEstimatoModal(true)}
                  style={{ cursor: kpi.revenueKnown ? "pointer" : "default" }}
                  title={kpi.revenueKnown ? "Clicca per vedere il dettaglio" : undefined}
                >
                  <div className="ag-kpi__label">Incasso stimato</div>
                  <div className="ag-kpi__value">{kpi.revenueKnown ? formatEuro(kpi.incassoStimato) : "—"}</div>
                </div>
                <div className="ag-kpi__item">
                  <div className="ag-kpi__label">Giornata</div>
                  <div className="ag-kpi__value">
                    {kpi.openMin ? (
                      kpi.occ >= 85 ? (
                        <span className="ag-day-full">Piena 🔴</span>
                      ) : kpi.occ >= 60 ? (
                        <span className="ag-day-busy">Intensa 🟡</span>
                      ) : (
                        <span className="ag-day-free">Libera 🟢</span>
                      )
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>

              {servicesErr && (
                <Alert variant="warning" className="mt-3 mb-0">
                  {servicesErr}
                </Alert>
              )}
              {err && (
                <Alert variant="danger" className="mt-3 mb-0">
                  <div className="fw-semibold">{err}</div>
                  {errDetails && <pre className="ag-pre mt-2 mb-0">{typeof errDetails === "string" ? errDetails : JSON.stringify(errDetails, null, 2)}</pre>}
                </Alert>
              )}
              {successMsg && (
                <Alert variant="success" className="mt-3 mb-0">
                  {successMsg}
                </Alert>
              )}
            </Card.Body>
          </Card>

          {viewMode === "day" && (
            <div className="mt-3 d-none d-md-block">
              <TimelineDay
                dateISO={dateISO}
                data={timeline}
                bookings={bookings}
                personalAppts={personalAppts}
                selectedBookingId={highlightedId}
                onBookingClick={handleTimelineBookingClick}
                onPersonalApptClick={pa => {
                  setEditingPersonal(pa);
                  setNewDrawerOpen(true);
                }}
              />
            </div>
          )}
        </Col>

        {/* RIGHT */}
        <Col lg={viewMode === "week" ? 12 : 8}>
          <Card className="ag-card h-100">
            <Card.Body className="ag-card__body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <div className="ag-title">Appuntamenti</div>
                  <div className="ag-subtitle">
                    {(viewMode === "week" && !isCompact) || (isCompact && compactTab === "week")
                      ? "Vista settimana"
                      : isCompact && compactTab === "timeline"
                        ? `Timeline · ${dateISO}`
                        : `${dateISO} · ${filtered.length}${hasStatusFilter ? ` di ${bookings.length}` : ""} risultati`}
                  </div>
                </div>
                {((viewMode === "day" && !isCompact) || (isCompact && compactTab === "appointments")) && (
                  <div className="d-flex gap-2 align-items-center">
                    <Form.Control className="ag-search" placeholder="Cerca cliente, telefono, servizio…" value={q} onChange={e => setQ(e.target.value)} />
                    <Button className="ag-btn ag-btn--ghost" onClick={refresh} disabled={loading}>
                      {loading ? <Spinner size="sm" /> : "Aggiorna"}
                    </Button>
                  </div>
                )}
              </div>

              {((viewMode === "day" && !isCompact) || (isCompact && compactTab === "appointments")) && (
                <div className="ag-filters">
                  <button type="button" className={`ag-filter-pill pill--all ${!hasStatusFilter ? "is-active" : ""}`} onClick={clearStatusFilters}>
                    <span>Tutti</span>
                    <span className="ag-filter-count">{bookings.length}</span>
                  </button>
                  {[
                    ["PENDING", "In attesa", "pending", statusCounts.pending],
                    ["CONFIRMED", "Confermati", "confirmed", statusCounts.confirmed],
                    ["COMPLETED", "Completati", "completed", statusCounts.completed],
                    ["CANCELLED", "Cancellati", "cancelled", statusCounts.cancelled],
                  ].map(([key, label, cls, count]) => (
                    <button
                      key={key}
                      type="button"
                      className={`ag-filter-pill pill--${cls} ${statusFilter.has(key) ? "is-active" : ""}`}
                      onClick={() => toggleStatus(key)}
                    >
                      <span>{label}</span>
                      <span className="ag-filter-count">{count}</span>
                    </button>
                  ))}
                </div>
              )}

              {(viewMode === "week" && !isCompact) || (isCompact && compactTab === "week") ? (
                <WeeklyCalendar
                  anchorDate={date}
                  onDayClick={handleWeekDayClick}
                  onBookingClick={handleWeekBookingClick}
                  onSlotClick={handleSlotClick}
                  onPrevWeek={() => setDate(d => addDays(d, -7))}
                  onNextWeek={() => setDate(d => addDays(d, 7))}
                  refreshKey={weekRefreshKey}
                  closedDates={closedDatesSet}
                />
              ) : isCompact && compactTab === "timeline" ? (
                <TimelineDay
                  dateISO={dateISO}
                  data={timeline}
                  bookings={bookings}
                  personalAppts={personalAppts}
                  selectedBookingId={highlightedId}
                  onBookingClick={handleCompactTimelineBookingClick}
                  onPersonalApptClick={pa => {
                    setEditingPersonal(pa);
                    setNewDrawerOpen(true);
                  }}
                />
              ) : (
                <>
                  <div className="ag-list">
                    {filtered.map(b => {
                      const initials = (() => {
                        if (!b.customerName) return "?";
                        const parts = b.customerName.trim().split(/\s+/);
                        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                      })();
                      const arretratiKey = agendaPkgKey(b.bookingId, "arretrati");
                      const arretratiOpen = expandedAgendaPkgs.has(arretratiKey);
                      const arretratiState = arretratiData[b.bookingId];
                      // Same stopPropagation contract as the package chevron — the badge
                      // toggle must NOT bubble to any card-level click (edit drawer).
                      const onArretratiToggle = e => {
                        e.stopPropagation();
                        const willOpen = !arretratiOpen;
                        toggleAgendaPkg(b.bookingId, "arretrati");
                        if (willOpen) loadArretrati(b.bookingId); // lazy-load on open
                      };
                      const onArretratiKeyDown = e => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onArretratiToggle(e); }
                      };
                      return (
                        <div
                          key={b.bookingId}
                          className={`ag-item${highlightedId === b.bookingId ? " ag-item--highlighted" : ""}`}
                          ref={el => {
                            if (el) itemRefsMap.current.set(b.bookingId, el);
                            else itemRefsMap.current.delete(b.bookingId);
                          }}
                        >
                          <div className="ag-item__header">
                            <div className="ag-item__avatar" aria-hidden="true">
                              {initials}
                            </div>

                            <div className="ag-item__main">
                              <div className="ag-item__name">
                                {b.customerName}
                                {b.customerVerified && <VerifiedBadge />}
                                {b.hasOutstanding && (
                                  <button
                                    type="button"
                                    className="ag-pill ag-pill--unpaid"
                                    style={{ marginLeft: 6 }}
                                    aria-expanded={arretratiOpen}
                                    title="Pagamenti arretrati da saldare"
                                    onClick={onArretratiToggle}
                                    onKeyDown={onArretratiKeyDown}
                                  >
                                    ⚠️ Arretrati
                                  </button>
                                )}
                              </div>
                              <div className="ag-item__service">
                                {(() => {
                                  // Phase 6b: ONE unified list of entries — every linked package
                                  // and every extra service is an equal citizen. Packages keep
                                  // their 📦 icon, "Seduta X/Y" badge, "⚠ Ultima" pill, "Pagato"
                                  // pill, and the pkgi-toggle collapsible; extras carry plain
                                  // typography only. Same divider between everything.
                                  // linkedPackages[] is the source of truth; legacy singular
                                  // linkedPackage wraps into a one-element list for pre-5a bookings.
                                  const itemPkgs = b.linkedPackages?.length
                                    ? b.linkedPackages
                                    : b.linkedPackage
                                      ? [b.linkedPackage]
                                      : [];
                                  const services = Array.isArray(b.services) && b.services.length > 0 ? b.services : [];
                                  // Phase 6e Bug 2: a custom service is a first-class entry in the
                                  // unified list. Previously the linkedPackages branch returned
                                  // before reaching the custom fallback, so a package+custom
                                  // booking dropped the custom from the card entirely.
                                  const hasCustom = !!(b.isCustomService && b.customServiceName);
                                  const promos = Array.isArray(b.linkedPromotions) ? b.linkedPromotions : [];
                                  const sales = Array.isArray(b.linkedSales) ? b.linkedSales : [];

                                  if (itemPkgs.length > 0 || promos.length > 0 || services.length > 0 || hasCustom || sales.length > 0) {
                                    // V62 Fix 2: per-line paid pills are ALWAYS visible —
                                    // no special-case branch when the appointment is fully
                                    // settled. Consistency beats the at-a-glance summary.
                                    // Filter out catalog services whose name duplicates a package
                                    // label (legacy collision avoidance — pre-Phase-4 bookings
                                    // sometimes carry the package's own service as a "duplicate"
                                    // entry in booking.services).
                                    const pkgLabelsNorm = new Set(
                                      itemPkgs
                                        .map(pkg => (pkg.packageName || pkg.serviceTitle || pkg.serviceName || "").trim().toLowerCase())
                                        .filter(Boolean),
                                    );
                                    const extras = services
                                      .map(s => {
                                        const svcLabel = s.name || s.title || s.serviceName || "?";
                                        return {
                                          label: s.optionName ? `${svcLabel} · ${s.optionName}` : svcLabel,
                                          paid: isLineSettled(s, b),
                                        };
                                      })
                                      .filter(x => !pkgLabelsNorm.has(x.label.trim().toLowerCase()));

                                    return (
                                      <div className="ag-svc-entries">
                                        {itemPkgs.map((pkg, pkgIdx) => {
                                          const pkgLabel = pkg.packageName || pkg.serviceTitle || pkg.serviceName || "—";
                                          // Per-package counters (Phase 6 DTO); legacy bookings fall back
                                          // to booking-level fields for the first link only.
                                          const sessionNum = pkg.sessionNumber ?? (pkgIdx === 0 ? b.currentSession : null);
                                          const totalSess = pkg.totalSessions ?? (pkgIdx === 0 ? b.totalSessions : null);
                                          const pkgItems = Array.isArray(pkg.items)
                                            ? [...pkg.items].sort((x, y) => x.position - y.position)
                                            : [];
                                          const hasMultipleItems = pkgItems.length >= 2;
                                          const expansionKey = agendaPkgKey(b.bookingId, pkg.packageAssignmentId);
                                          const isExpanded = expandedAgendaPkgs.has(expansionKey);
                                          // Chevron handlers MUST stop propagation — the surrounding
                                          // booking card has its own click that opens the edit drawer.
                                          const onChevronClick = e => {
                                            e.stopPropagation();
                                            toggleAgendaPkg(b.bookingId, pkg.packageAssignmentId);
                                          };
                                          const onChevronKeyDown = e => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              toggleAgendaPkg(b.bookingId, pkg.packageAssignmentId);
                                            }
                                          };
                                          return (
                                            <Fragment key={pkg.packageAssignmentId ?? `pkg-${pkgIdx}`}>
                                            <div className="ag-svc-entries__row">
                                              <span className="ag-svc-entries__pkg-icon" aria-hidden="true">📦</span>
                                              <span className="ag-svc-entries__name">{pkgLabel}</span>
                                              {sessionNum && totalSess && (
                                                <span className="ag-pkg-session-badge">
                                                  Seduta {sessionNum}/{totalSess}
                                                </span>
                                              )}
                                              {/* Phase 6a fix: the badge marks THIS booking as the
                                                  last session, not the package's live state. */}
                                              {sessionNum && totalSess && sessionNum === totalSess && (
                                                <span className="ag-session-pill ag-session-pill--last" style={{ marginLeft: 4 }}>
                                                  ⚠ Ultima
                                                </span>
                                              )}
                                              {/* V62 Fix 2: per-session paid pill, always shown.
                                                  pkg.paid already folds in paidUpfront on the
                                                  backend. INSTALLMENTS plans show a neutral
                                                  "Piano rate" pill instead (per-session price €0). */}
                                              {pkg.paymentMode === "INSTALLMENTS" ? (
                                                <InstallmentPlanPill dueRows={dueByPackage.get(String(pkg.packageAssignmentId))} />
                                              ) : (
                                                <span
                                                  className={`ag-pill ${pkg.paid ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                                                  title={pkg.paidUpfront ? "Pacchetto pagato in anticipo" : (pkg.paid ? "Sessione pagata" : "Sessione da pagare")}
                                                >
                                                  {pkg.paid ? "✓ Pagato" : "⏳ Da pagare"}
                                                </span>
                                              )}
                                              {hasMultipleItems && (
                                                <button
                                                  type="button"
                                                  className="pkgi-toggle"
                                                  aria-expanded={isExpanded}
                                                  onClick={onChevronClick}
                                                  onKeyDown={onChevronKeyDown}
                                                >
                                                  <span className={`pkgi-toggle__chevron${isExpanded ? " is-expanded" : ""}`}>▸</span>
                                                  {pkgItems.length} trattamenti
                                                </button>
                                              )}
                                              {hasMultipleItems && isExpanded && (
                                                <ul className="pkgi-list">
                                                  {pkgItems.map(it => (
                                                    <li
                                                      key={`${b.bookingId}-${pkg.packageAssignmentId ?? pkgIdx}-${it.position}`}
                                                      className="pkgi-list__item"
                                                    >
                                                      {formatPackageItemLabel(it)}
                                                    </li>
                                                  ))}
                                                </ul>
                                              )}
                                            </div>
                                            {pkg.paymentMode === "INSTALLMENTS" && (
                                              <InstallmentDueAction
                                                dueRows={dueByPackage.get(String(pkg.packageAssignmentId))}
                                                settling={installmentSettling}
                                                onSettle={row =>
                                                  requestSettleInstallment({
                                                    assignmentId: pkg.packageAssignmentId,
                                                    installmentId: row.installmentId,
                                                    clientName: b.customerName,
                                                    amount: row.amount,
                                                  })
                                                }
                                              />
                                            )}
                                            </Fragment>
                                          );
                                        })}
                                        {promos.map((promo, promoIdx) => {
                                          const promoTitle = promo.title || "Promozione";
                                          const promoServices = Array.isArray(promo.services) ? promo.services : [];
                                          const promoProducts = Array.isArray(promo.products) ? promo.products : [];
                                          const promoItems = [...promoServices, ...promoProducts];
                                          const hasPromoItems = promoItems.length >= 1;
                                          // Namespaced key so promo dropdowns never collide with package
                                          // dropdowns — both reuse expandedAgendaPkgs / agendaPkgKey /
                                          // toggleAgendaPkg, exactly like the "arretrati" sentinel does.
                                          const promoKeyId = `promo-${promo.promotionLinkId ?? promo.promotionId ?? promoIdx}`;
                                          const promoExpansionKey = agendaPkgKey(b.bookingId, promoKeyId);
                                          const isPromoExpanded = expandedAgendaPkgs.has(promoExpansionKey);
                                          // paidOnline (Stripe promo purchase, 08.4) overrides the per-link
                                          // paid flag, exactly as isLineSettled does for services/packages.
                                          const promoPaid = isLineSettled(promo, b);
                                          const onPromoChevronClick = e => {
                                            e.stopPropagation();
                                            toggleAgendaPkg(b.bookingId, promoKeyId);
                                          };
                                          const onPromoChevronKeyDown = e => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              toggleAgendaPkg(b.bookingId, promoKeyId);
                                            }
                                          };
                                          return (
                                            <div className="ag-svc-entries__row" key={promoKeyId}>
                                              <span className="ag-svc-entries__promo-icon" aria-hidden="true">🏷️</span>
                                              <span className="ag-svc-entries__name">{promoTitle}</span>
                                              <span
                                                className={`ag-pill ${promoPaid ? "ag-pill--paid" : "ag-pill--unpaid"}`}
                                                title={promoPaid ? "Promozione pagata" : "Promozione da pagare"}
                                              >
                                                {promoPaid ? "✓ Pagato" : "⏳ Da pagare"}
                                              </span>
                                              {hasPromoItems && (
                                                <button
                                                  type="button"
                                                  className="pkgi-toggle"
                                                  aria-expanded={isPromoExpanded}
                                                  onClick={onPromoChevronClick}
                                                  onKeyDown={onPromoChevronKeyDown}
                                                >
                                                  <span className={`pkgi-toggle__chevron${isPromoExpanded ? " is-expanded" : ""}`}>▸</span>
                                                  {promoItems.length} element{promoItems.length === 1 ? "o" : "i"}
                                                </button>
                                              )}
                                              {hasPromoItems && isPromoExpanded && (
                                                <ul className="pkgi-list">
                                                  {promoItems.map((it, itIdx) => (
                                                    <li key={`${b.bookingId}-${promoKeyId}-${it.refId ?? itIdx}`} className="pkgi-list__item">
                                                      {it.name}
                                                    </li>
                                                  ))}
                                                </ul>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {extras.map((x, i) => (
                                          <div className="ag-svc-entries__row" key={`extra-${i}`}>
                                            <span className="ag-svc-entries__name">{x.label}</span>
                                            <span className={`ag-pill ${x.paid ? "ag-pill--paid" : "ag-pill--unpaid"}`}>
                                              {x.paid ? "✓ Pagato" : "⏳ Da pagare"}
                                            </span>
                                          </div>
                                        ))}
                                        {/* Phase 6e Bug 2: custom service as a normal entry —
                                            same typography, no 📦, no badge. Placed last so
                                            packages → catalog extras → custom is the consistent
                                            order across packaged AND package-less bookings. */}
                                        {hasCustom && (
                                          <div className="ag-svc-entries__row" key="custom">
                                            <span className="ag-svc-entries__name">
                                              <em>{b.customServiceName}</em>
                                            </span>
                                            <span className={`ag-pill ${isCustomSettled(b) ? "ag-pill--paid" : "ag-pill--unpaid"}`}>
                                              {isCustomSettled(b) ? "✓ Pagato" : "⏳ Da pagare"}
                                            </span>
                                          </div>
                                        )}
                                        {/* Block B: standalone product sales — 🛍️ rows after
                                            services/custom. promo-linked sales (promotionLinkId != null)
                                            already under the promotion dropdown above. */}
                                        {sales.map((sale, saleIdx) => {
                                          const saleQty = sale.quantity ?? 1;
                                          const salePaid = sale.paid === true;
                                          return (
                                            <div className="ag-svc-entries__row" key={`sale-${sale.saleId ?? saleIdx}`}>
                                              <span className="ag-svc-entries__promo-icon" aria-hidden="true">🛍️</span>
                                              <span className="ag-svc-entries__name">
                                                {sale.productName || "Prodotto"}
                                                {saleQty > 1 ? ` ×${saleQty}` : ""}
                                              </span>
                                              <span className={`ag-pill ${salePaid ? "ag-pill--paid" : "ag-pill--unpaid"}`}>
                                                {salePaid ? "✓ Pagato" : "⏳ Da pagare"}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  }
                                  if (b.serviceTitle) {
                                    const principalPaid =
                                      b.paidOnline || b.paidInStore || isBookingPackageCreditBacked(b);
                                    return (
                                      <div className="ag-svc-entries">
                                        <div className="ag-svc-entries__row">
                                          <span className="ag-svc-entries__name">
                                            {b.serviceTitle}
                                            {b.optionName ? ` · ${b.optionName}` : ""}
                                          </span>
                                          <span className={`ag-pill ${principalPaid ? "ag-pill--paid" : "ag-pill--unpaid"}`}>
                                            {principalPaid ? "✓ Pagato" : "⏳ Da pagare"}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return <span className="ag-service">—</span>;
                                })()}
                                {/* Legacy session pills: only when the booking is NOT linked to any
                                    in-person package (the per-package "Seduta X/Y" badges above
                                    cover the linked case for both Phase 6 and pre-5a data). */}
                                {!(b.linkedPackages?.length || b.linkedPackage) && b.currentSession && b.totalSessions && (
                                  <span className="ag-session-pill">
                                    Seduta {b.currentSession}/{b.totalSessions}
                                  </span>
                                )}
                                {!(b.linkedPackages?.length || b.linkedPackage) && b.sessionsRemaining === 1 && (
                                  <span className="ag-session-pill ag-session-pill--last">⚠ Ultima seduta</span>
                                )}
                                {/* Problem 6: dedupe package notes — same assignment can be
                                    linked twice through legacy linkedPackage + linkedPackages[]. */}
                                {(() => {
                                  const allPkgs = b.linkedPackages?.length
                                    ? b.linkedPackages
                                    : b.linkedPackage ? [b.linkedPackage] : [];
                                  const seen = new Set();
                                  const noteRows = [];
                                  allPkgs.forEach(p => {
                                    const note = (p?.notes ?? "").trim();
                                    if (!note) return;
                                    const key = p?.packageAssignmentId ?? note;
                                    if (seen.has(key)) return;
                                    seen.add(key);
                                    noteRows.push({ key, note });
                                  });
                                  return noteRows.map(({ key, note }) => (
                                    <div key={`pkg-note-${key}`} className="ag-note ag-note--package">
                                      <span className="ag-note__label">Nota pacchetto</span>
                                      <span className="ag-note__text">{note}</span>
                                    </div>
                                  ));
                                })()}
                                {b.notes && (
                                  <div className="ag-note ag-note--appointment">
                                    <span className="ag-note__label">Nota appuntamento</span>
                                    <span className="ag-note__text">{b.notes}</span>
                                  </div>
                                )}
                              </div>
                              <div className="ag-item__contacts">
                                <span className="ag-item__contact-item">
                                  📱 {b.customerPhone}
                                  {b.customerPhone && (
                                    <button
                                      className="ag-wa-btn"
                                      type="button"
                                      title="Apri WhatsApp"
                                      onClick={e => {
                                        e.stopPropagation();
                                        openWhatsApp(b.customerPhone);
                                      }}
                                    >
                                      <span className="ag-wa-btn__icon">💬</span>
                                      <span>WhatsApp</span>
                                    </button>
                                  )}
                                </span>
                                <span className="ag-item__contact-divider" aria-hidden="true" />
                                <span className="ag-item__contact-item">
                                  <span aria-hidden="true">✉</span>
                                  {b.customerEmail && (
                                    <a className="ag-item__email-link" href={`mailto:${b.customerEmail}`}>
                                      {b.customerEmail}
                                    </a>
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="ag-item__timecol">
                              <div className="ag-item__pills">
                                {!b.createdByAdmin && (
                                  b.paidOnline
                                    ? (b.status !== "REFUNDED" && <PaidOnlineBadge />)
                                    : <OnlineBadge />
                                )}
                                <StatusPill status={b.status} />
                                {/* V62 Fix 2: top-right "Pagato" pill removed in favour of
                                    always-visible per-line pills below. Refund keeps its
                                    own dedicated state because it's not a line concept. */}
                                {b.paidOnline && b.status === "REFUNDED" && (
                                  <span className="ag-pill ag-pill--cancelled">✓ Rimborsato</span>
                                )}
                              </div>
                              <div className="ag-item__timeMain">
                                {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                              </div>
                              <div className="ag-item__timeSub">
                                {formatDuration(Math.max(0, Math.round((new Date(b.endTime) - new Date(b.startTime)) / 60000)))}
                                {b.paddingMinutes > 0 && <span> · +{b.paddingMinutes}′</span>}
                              </div>
                            </div>
                          </div>

                          {b.consentRequired && (
                            <div className="ag-item__consent">
                              {b.consentSigned ? (
                                <span className="agenda-consent-badge agenda-consent-badge--signed">
                                  ✅ Consenso firmato
                                  {b.consentSignedAt && (
                                    <span style={{ marginLeft: 4, fontWeight: 400, opacity: 0.8 }}>
                                      il {new Date(b.consentSignedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <>
                                  <span className="agenda-consent-badge agenda-consent-badge--pending">✍️ Consenso da firmare</span>
                                  {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                                    <button type="button" className="agenda-consent-btn" onClick={() => signConsent(b)}>
                                      Segna consenso firmato
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {(b.status === "PENDING" || b.status === "PENDING_PAYMENT" || b.status === "CONFIRMED") &&
                            b.customerPhone &&
                            (() => {
                              const sentAt = b.reminderSentAt;
                              const isPending = reminderPending.has(b.bookingId);
                              const isBusy = reminderBusy.has(b.bookingId);
                              const laser = isLaserBooking(b);

                              if (sentAt) {
                                return (
                                  <div className="ag-reminder-row ag-reminder-row--sent">
                                    <span className="ag-reminder-badge">
                                      {"✓ Promemoria inviato"}
                                      <span className="ag-reminder-badge__time">
                                        {" · "}
                                        {new Date(sentAt).toLocaleString("it-IT", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </span>
                                    <div className="ag-reminder-row__links">
                                      <button type="button" className="ag-reminder-link" onClick={() => openReminderWhatsApp(b)}>
                                        Invia di nuovo
                                      </button>
                                      <button
                                        type="button"
                                        className="ag-reminder-link ag-reminder-link--muted"
                                        disabled={isBusy}
                                        onClick={() => undoReminderSent(b)}
                                      >
                                        {isBusy ? "…" : "Annulla"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              if (isPending) {
                                return (
                                  <div className="ag-reminder-row ag-reminder-row--pending">
                                    <span className="ag-reminder-pending-text">
                                      Promemoria aperto in WhatsApp {"—"} l{"’"}hai inviato?
                                    </span>
                                    <div className="ag-reminder-row__actions">
                                      <button
                                        type="button"
                                        className="ag-reminder-btn ag-reminder-btn--confirm"
                                        disabled={isBusy}
                                        onClick={() => confirmReminderSent(b)}
                                      >
                                        {isBusy ? "…" : "✓ Sì, inviato"}
                                      </button>
                                      <button
                                        type="button"
                                        className="ag-reminder-btn ag-reminder-btn--ghost"
                                        disabled={isBusy}
                                        onClick={() => dismissReminderPending(b.bookingId)}
                                      >
                                        Non inviato
                                      </button>
                                      <button type="button" className="ag-reminder-link" onClick={() => openReminderWhatsApp(b)}>
                                        Riapri
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="ag-reminder-row">
                                  <button
                                    type="button"
                                    className="ag-reminder-btn ag-reminder-btn--send"
                                    title={buildReminderMessage(b)}
                                    onClick={() => handleSendReminder(b)}
                                  >
                                    <span className="ag-reminder-btn__icon" aria-hidden="true">
                                      {"💬"}
                                    </span>
                                    Invia promemoria
                                  </button>
                                  {laser && (
                                    <span
                                      className="ag-reminder-tag"
                                      title="Verrà usato il messaggio con le istruzioni per il laser"
                                    >
                                      {"✨ versione laser"}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}

                          <div className="ag-item__actions">
                            {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                              <Button className="ag-btn ag-btn--soft" size="sm" onClick={() => openEdit(b)}>
                                Modifica
                              </Button>
                            )}
                            {b.status !== "CANCELLED" && (
                              <Button
                                className="ag-btn ag-btn--soft"
                                size="sm"
                                title="Crea un nuovo appuntamento con gli stessi dati"
                                onClick={() => {
                                  setEditingBooking({
                                    _duplicate: true,
                                    customerName: b.customerName,
                                    customerEmail: b.customerEmail,
                                    customerPhone: b.customerPhone,
                                    customerId: b.customerId ?? null,
                                    services: b.services ?? null,
                                    serviceId: b.serviceId ?? null,
                                    serviceOptionId: b.serviceOptionId ?? null,
                                    notes: b.notes ?? "",
                                    startTime: null,
                                  });
                                  setNewDrawerOpen(true);
                                }}
                              >
                                Ripeti
                              </Button>
                            )}
                            {(b.status === "PENDING" || b.status === "PENDING_PAYMENT") && (
                              <Button className="ag-btn ag-btn--primary" size="sm" onClick={() => changeStatus(b.bookingId, "CONFIRMED")}>
                                Conferma
                              </Button>
                            )}
                            {b.status === "CONFIRMED" && (
                              <>
                                <Button
                                  className="ag-btn ag-btn--ok"
                                  size="sm"
                                  onClick={() => handleCompleteClick(b)}
                                >
                                  Completa
                                </Button>
                                <Button
                                  className="ag-btn ag-btn--ghost"
                                  size="sm"
                                  onClick={() => setConfirmModal({ type: "noshow", bookingId: b.bookingId, customerName: b.customerName })}
                                >
                                  Non presentata
                                </Button>
                              </>
                            )}
                            {b.status === "COMPLETED" && completedUndo[b.bookingId] && (
                              <Button
                                className="ag-btn ag-btn-undo"
                                onClick={() => undoCompletion(b)}
                              >
                                ↩ Annulla completamento
                              </Button>
                            )}
                            {(b.status === "PENDING" || b.status === "PENDING_PAYMENT" || b.status === "CONFIRMED") && (
                              <Button className="ag-btn ag-btn--ghost" size="sm" onClick={() => askCancel(b)}>
                                Annulla
                              </Button>
                            )}
                            {b.refundable && (
                              <Button className="ag-btn ag-btn--danger" size="sm" onClick={() => handleRefund(b)}>
                                {b.status === "PENDING_PAYMENT" ? "Annulla e rimborsa" : "Rimborsa"}
                              </Button>
                            )}
                            <Button className="ag-btn ag-btn--danger" size="sm" onClick={() => askDelete(b)}>
                              Elimina
                            </Button>
                          </div>

                          {/* Arretrati dropdown — expands the item below the actions (NOT the
                              absolute timeline). Lazy-loaded on open; rows reuse settle from Fase 1. */}
                          {arretratiOpen && (
                            <div
                              style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(140,109,63,0.18)", display: "flex", flexDirection: "column", gap: 6 }}
                            >
                              {arretratiState?.loading && <span className="ag-muted">Caricamento arretrati…</span>}
                              {arretratiState?.error && <span className="ag-pill ag-pill--unpaid">{arretratiState.error}</span>}
                              {!arretratiState?.loading && !arretratiState?.error && (arretratiState?.items ?? []).length === 0 && (
                                <span className="ag-muted">Nessun arretrato — tutto saldato ✓</span>
                              )}
                              {(arretratiState?.items ?? []).map((a, idx) => {
                                const rowKey = arretratoRowKey(a);
                                const busy = arretratoSettling === rowKey;
                                const errored = arretratoError === rowKey;
                                return (
                                  <div key={`${rowKey}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="ag-item__service">{a.label}</div>
                                      <div className="ag-muted" style={{ fontSize: "0.78rem" }}>
                                        {new Date(a.occurredAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                                      </div>
                                    </div>
                                    <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                                      {formatEuro(a.price)}
                                    </span>
                                    <button
                                      type="button"
                                      className="ag-pill ag-pill--toggle"
                                      disabled={arretratoSettling !== null}
                                      onClick={() => setConfirmArretrato({ card: b, a })}
                                    >
                                      {busy ? "…" : errored ? "Riprova" : "Salda"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {b.status !== "CANCELLED" &&
                            b.status !== "COMPLETED" &&
                            (() => {
                              const maxPad = paddingMaxMap.get(b.bookingId) ?? 120;
                              const currentPad = b.paddingMinutes ?? 0;
                              const isEditing = paddingEditing === b.bookingId;
                              const isSaving = paddingSaving === b.bookingId;

                              return (
                                <div className="ag-padding-row">
                                  {!isEditing ? (
                                    <>
                                      <span className="ag-padding-row__label">{currentPad > 0 ? `⏱ +${currentPad}′ buffer` : "⏱ Nessun buffer"}</span>
                                      {maxPad > 0 ? (
                                        <button
                                          type="button"
                                          className="ag-padding-row__btn"
                                          onClick={() => {
                                            setPaddingDraft(b.paddingMinutes ?? 0);
                                            setPaddingEditing(b.bookingId);
                                          }}
                                        >
                                          {currentPad > 0 ? "Modifica" : "+ Buffer"}
                                        </button>
                                      ) : (
                                        <span className="ag-padding-row__blocked">Slot pieno — nessun buffer possibile</span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span className="ag-padding-row__label">Buffer (max {maxPad}′)</span>
                                      <div className="ag-padding-row__controls">
                                        {[0, 15, 30, 45]
                                          .filter(p => p <= maxPad)
                                          .map(p => (
                                            <button
                                              key={p}
                                              type="button"
                                              disabled={isSaving}
                                              className={`ag-nextslot__chip ${paddingDraft === p ? "is-active" : ""}`}
                                              onClick={() => setPaddingDraft(p)}
                                            >
                                              {p === 0 ? "Nessuno" : `+${p}′`}
                                            </button>
                                          ))}
                                        <button
                                          type="button"
                                          className="ag-padding-row__step"
                                          disabled={paddingDraft <= 0 || isSaving}
                                          onClick={() => setPaddingDraft(v => Math.max(0, v - 5))}
                                        >
                                          −
                                        </button>
                                        <span className="ag-padding-row__val">{paddingDraft}′</span>
                                        <button
                                          type="button"
                                          className="ag-padding-row__step"
                                          disabled={paddingDraft >= maxPad || isSaving}
                                          onClick={() => setPaddingDraft(v => Math.min(maxPad, v + 5))}
                                        >
                                          +
                                        </button>
                                        <button
                                          type="button"
                                          className="ag-padding-row__btn"
                                          disabled={isSaving}
                                          onClick={() => savePadding(b.bookingId, paddingDraft)}
                                          style={{ marginLeft: 4 }}
                                        >
                                          {isSaving ? <Spinner size="sm" animation="border" /> : "Conferma"}
                                        </button>
                                        <button type="button" className="ag-padding-row__cancel" disabled={isSaving} onClick={() => setPaddingEditing(null)}>
                                          ✕
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      );
                    })}

                    {!filtered.length && (
                      <div className="ag-empty">
                        <div className="ag-empty__title">Nessun appuntamento</div>
                        <div className="ag-empty__text">Per questo giorno non risultano prenotazioni.</div>
                        <Button className="ag-btn ag-btn--primary mt-2" onClick={openCreate}>
                          + Inserisci appuntamento
                        </Button>
                      </div>
                    )}
                  </div>
                  {personalAppts.length > 0 && (
                    <div className="ag-personal-section">
                      <div className="ag-personal-section__title">Agenda personale</div>
                      {personalAppts
                        .slice()
                        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
                        .map(pa => (
                          <div
                            key={pa.id}
                            className="ag-personal-card"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setEditingPersonal(pa);
                              setNewDrawerOpen(true);
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setEditingPersonal(pa);
                                setNewDrawerOpen(true);
                              }
                            }}
                          >
                            <div className="ag-personal-card__time">{(pa.startTime || "").slice(0, 5)}</div>
                            <div className="ag-personal-card__body">
                              <div className="ag-personal-card__title">{pa.title}</div>
                              <div className="ag-personal-card__meta">
                                {pa.durationMinutes}′{pa.notes ? ` · ${pa.notes}` : ""}
                              </div>
                            </div>
                            <span className="ag-personal-badge">Personale</span>
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="ag-footnote mt-2">Tip: "Modifica" apre la scheda completa. Per i walk-in puoi creare velocemente senza email.</div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {confirmModal && (
        <div className="ag-confirm-overlay" onClick={() => setConfirmModal(null)}>
          <div className="ag-confirm-box" onClick={e => e.stopPropagation()}>
            <div className="ag-confirm-icon">{confirmModal.type === "delete" ? "🗑️" : confirmModal.type === "noshow" ? "⚠️" : "✕"}</div>
            <div className="ag-confirm-title">
              {confirmModal.type === "delete" ? "Elimina prenotazione" : confirmModal.type === "noshow" ? "Cliente non presentata?" : "Annulla prenotazione"}
            </div>
            <div className="ag-confirm-body">
              {confirmModal.type === "delete" ? (
                <>
                  Vuoi eliminare definitivamente l&apos;appuntamento di <b>{confirmModal.customerName}</b>? Questa azione è irreversibile.
                </>
              ) : confirmModal.type === "noshow" ? (
                <>
                  Questa azione segnerà l&apos;appuntamento di <b>{confirmModal.customerName}</b> come non presentato.
                </>
              ) : (
                <>
                  Vuoi annullare l&apos;appuntamento di <b>{confirmModal.customerName}</b>? Rimarrà nello storico come &quot;Cancellato&quot;.
                </>
              )}
            </div>
            {confirmModal.type === "delete" && confirmModal.stripeSessionId && (
              <div className="ag-confirm-warning">⚠️ Questa prenotazione è stata pagata online. Eliminandola non verrà emesso alcun rimborso automatico.</div>
            )}
            {confirmModal.type === "delete" &&
              confirmModal.booking?.status === "COMPLETED" &&
              (confirmModal.booking?.packageCreditId ||
                (Array.isArray(confirmModal.booking?.linkedPackages) && confirmModal.booking.linkedPackages.length > 0) ||
                confirmModal.booking?.linkedPackage) && (
                <div className="ag-confirm-warning">
                  ⚠️ Questa prenotazione è COMPLETATA e collegata a un pacchetto. La seduta consumata NON verrà ripristinata automaticamente.
                </div>
              )}
            <div className="ag-confirm-actions">
              <button className="ag-btn ag-btn--ghost" onClick={() => setConfirmModal(null)}>
                Indietro
              </button>
              <button
                className={`ag-btn ${confirmModal.type === "delete" ? "ag-btn--danger" : confirmModal.type === "noshow" ? "ag-btn--danger" : "ag-btn--ghost"}`}
                onClick={() => {
                  if (confirmModal.type === "delete") removeBooking(confirmModal.booking);
                  else if (confirmModal.type === "noshow") changeStatus(confirmModal.bookingId, "NO_SHOW");
                  else changeStatus(confirmModal.bookingId, "CANCELLED");
                  setConfirmModal(null);
                }}
              >
                {confirmModal.type === "delete" ? "Elimina" : confirmModal.type === "noshow" ? "Conferma" : "Annulla appuntamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="ag-snackbar">
          <span className="ag-snackbar__text">
            Appuntamento di <b>{pendingDelete.booking.customerName}</b> eliminato
          </span>
          <button type="button" className="ag-snackbar__undo" onClick={undoDelete}>
            Annulla
          </button>
          <span className="ag-snackbar__countdown">{deleteCountdown}</span>
        </div>
      )}

      <BookingModal
        show={modalOpen}
        onHide={() => setModalOpen(false)}
        mode={modalMode}
        initial={modalMode === "edit" ? selected : selected?.startTime ? selected : null}
        services={services}
        onSubmit={submitModal}
      />

      {/* New multi-service / personal appointment drawer.
          Rendered independently — does not interfere with BookingModal. */}
      <NewAppointmentDrawer
        isOpen={newDrawerOpen}
        onClose={() => {
          setNewDrawerOpen(false);
          setEditingPersonal(null);
          setEditingBooking(null);
        }}
        selectedDate={dateISO}
        services={services}
        editingPersonal={editingPersonal}
        editBooking={editingBooking}
        onPersonalSaved={() => {
          refresh();
          if (viewMode === "week") setWeekRefreshKey(k => k + 1);
        }}
        onAppointmentSaved={msg => {
          refresh();
          if (viewMode === "week") setWeekRefreshKey(k => k + 1);
          setSuccessMsg(msg || "Appuntamento creato");
        }}
      />

      <ClosuresDrawer
        isOpen={closuresDrawerOpen}
        onClose={() => setClosuresDrawerOpen(false)}
        selectedDate={dateISO}
        dayOpenRanges={timeline?.openRanges}
        onClosuresChanged={() => {
          refreshClosures();
          refresh();
          if (viewMode === "week") setWeekRefreshKey(k => k + 1);
        }}
      />

      <ConfirmDialog
        show={!!confirmArretrato}
        onHide={() => setConfirmArretrato(null)}
        onConfirm={() => {
          const ctx = confirmArretrato;
          setConfirmArretrato(null);
          if (ctx) settleArretrato(ctx.card, ctx.a);
        }}
        title="Salda arretrato"
        message={
          confirmArretrato
            ? `Confermi di saldare questo arretrato? ${confirmArretrato.a.label} del ${new Date(confirmArretrato.a.occurredAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })} — ${formatEuro(confirmArretrato.a.price)}`
            : ""
        }
        confirmLabel="Salda"
        confirmVariant="primary"
      />

      <ConfirmDialog
        show={!!refundConfirmBooking}
        onHide={() => setRefundConfirmBooking(null)}
        onConfirm={executeRefund}
        title="Conferma rimborso"
        message={
          refundConfirmBooking
            ? `Rimborsare ${refundConfirmBooking.customerName} per ${refundConfirmBooking.serviceTitle || "questo appuntamento"}? L'importo verrà accreditato su Stripe e il cliente riceverà una email di conferma.`
            : ""
        }
        confirmLabel={refundConfirmBooking?.status === "PENDING_PAYMENT" ? "Annulla e rimborsa" : "Rimborsa"}
        confirmVariant="danger"
      />

      <ConfirmDialog
        show={!!consentConfirmBooking}
        onHide={() => setConsentConfirmBooking(null)}
        onConfirm={executeSignConsent}
        title="Firma consenso informato"
        message={consentConfirmBooking ? `Confermi che il consenso informato è stato firmato da ${consentConfirmBooking.customerName}?` : ""}
        confirmLabel="Conferma"
        confirmVariant="primary"
      />

      <ConfirmDialog {...installmentConfirmProps} />

      {showEstimatoModal && (
        <EstimatoModal
          bookings={bookings}
          services={services}
          dueList={dueList}
          settling={installmentSettling}
          onSettleInstallment={requestSettleInstallment}
          onClose={() => setShowEstimatoModal(false)}
        />
      )}

      {completionDrawer && (
        <CompletionDrawer
          booking={completionDrawer.booking}
          items={completionDrawer.items}
          onClose={() => setCompletionDrawer(null)}
          onConfirm={handleDrawerConfirm}
        />
      )}

      {/* ── Floating action buttons (compact only — hidden on desktop by CSS) ── */}
      {isCompact && (
        <div className="ag-fab-container" aria-label="Azioni rapide">
          <button type="button" className="ag-fab ag-fab--primary" title="Nuovo appuntamento" aria-label="Nuovo appuntamento" onClick={openCreate}>
            +
          </button>
          <button
            type="button"
            className="ag-fab ag-fab--secondary"
            title="Gestisci chiusure"
            aria-label="Gestisci chiusure"
            onClick={() => setClosuresDrawerOpen(true)}
          >
            🔒
          </button>
        </div>
      )}
    </Container>
  );
}
