import { normalizeItalianPhone } from "../../../utils/reminders";

// Local copies for the clients feature. Do NOT share with the agenda's own
// STATUS_META/StatusPill — these are intentionally independent.
// StatusPill (the only JSX) lives in ./StatusPill so this stays a pure module.
export const STATUS_META = {
  PENDING: { label: "In attesa", tone: "pending" },
  PENDING_PAYMENT: { label: "Attesa pagamento", tone: "pending" },
  NO_SHOW: { label: "Non presentata", tone: "noshow" },
  CONFIRMED: { label: "Confermato", tone: "confirmed" },
  COMPLETED: { label: "Completato", tone: "completed" },
  CANCELLED: { label: "Cancellato", tone: "cancelled" },
};

export function earliestBookingDate(bookings) {
  if (!bookings?.length) return null;
  const last = bookings[bookings.length - 1];
  return last.startTime ? new Date(last.startTime) : null;
}

export function formatDateTimeIT(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const openWhatsApp = phone => {
  const number = normalizeItalianPhone(phone);
  if (!number) return;
  window.open(`https://wa.me/${number}`, "_blank", "noopener,noreferrer");
};

// Compact "12 mar 2025" — used by the KPI tiles + hero. Returns "—" for null.
export function formatDateShortIT(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Capitalized Italian month names for the timeline group headers.
const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

/**
 * Group an already-ordered booking array by month/year for the timeline, WITHOUT
 * reordering — groups appear in first-seen order and items keep their incoming
 * order (newest-first for storico, soonest-first for upcoming). Pure/presentation.
 * → [{ label: "Marzo 2025", items: [...] }]
 */
export function groupByMonthYear(bookings) {
  const groups = [];
  const byKey = new Map();
  (bookings || []).forEach(b => {
    const d = b?.startTime ? new Date(b.startTime) : null;
    const key = d ? `${d.getFullYear()}-${d.getMonth()}` : "nodate";
    const label = d ? `${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}` : "Senza data";
    let g = byKey.get(key);
    if (!g) {
      g = { label, items: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.items.push(b);
  });
  return groups;
}

/**
 * Derive the customer state chip from already-fetched signals. Pure, null-robust:
 *   "nuovo"        first booking < 30 days ago
 *   "da-risentire" last completed visit exists AND > 60 days ago AND no upcoming
 *   "attivo"       otherwise (also the safe default when data is missing)
 * Mirrors the backend win-back rule (60 days + no active future booking).
 */
export function deriveCustomerStatus({ firstBookingDate, lastVisitDate, hasUpcoming }) {
  const DAY = 1000 * 60 * 60 * 24;
  const now = Date.now();
  if (firstBookingDate && (now - firstBookingDate.getTime()) / DAY < 30) return "nuovo";
  if (lastVisitDate && (now - lastVisitDate.getTime()) / DAY > 60 && !hasUpcoming) return "da-risentire";
  return "attivo";
}

export function daysUntilExpiry(isoDate) {
  if (!isoDate) return null;
  const diff = new Date(isoDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function expiryTag(isoDate) {
  const days = daysUntilExpiry(isoDate);
  if (days === null) return null;
  if (days < 0)   return { label: "Scaduto",           cls: "pkg-tag pkg-tag--expired"  };
  if (days <= 30) return { label: `Scade in ${days}g`, cls: "pkg-tag pkg-tag--expiring" };
  return           { label: `Scade in ${days}g`,        cls: "pkg-tag pkg-tag--ok"       };
}
