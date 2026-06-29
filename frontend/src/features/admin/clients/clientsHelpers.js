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
