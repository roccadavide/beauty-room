// src/utils/reminders.js
// WhatsApp reminder helpers for the admin agenda. No external dependencies.
// Lo stato "promemoria inviato" è persistito lato backend (campo
// reminderSentAt su ogni booking) — qui restano solo i builder del
// messaggio e la normalizzazione del numero di telefono.

/** Indirizzo del salone — usato in ogni messaggio di promemoria. */
const SALON_ADDRESS = "Viale Risorgimento 587, Calusco d’Adda";

/** Sottostringa (normalizzata) che identifica un servizio di epilazione laser. */
const LASER_SERVICE_MATCH = "epilazione laser";

// ── Normalizzazione numero di telefono ───────────────────────────────

/**
 * Normalizza un numero italiano nel formato richiesto da wa.me
 * (solo cifre, prefisso internazionale incluso, niente '+').
 */
export function normalizeItalianPhone(raw) {
  if (!raw) return "";
  let clean = String(raw).replace(/[^\d+]/g, "");
  if (clean.startsWith("+")) clean = clean.slice(1);
  if (clean.startsWith("00")) clean = clean.slice(2);
  if (clean.startsWith("39") && clean.length >= 11) return clean;
  if (clean.length === 10 && clean.startsWith("3")) return `39${clean}`;
  return clean.startsWith("39") ? clean : `39${clean}`;
}

/** Costruisce un link wa.me con messaggio precompilato. */
export function buildWhatsAppUrl(phone, message) {
  return `https://wa.me/${normalizeItalianPhone(phone)}?text=${encodeURIComponent(message)}`;
}

// ── Rilevamento servizio laser ───────────────────────────────────────

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

/** Raccoglie ogni stringa "nome servizio" collegata a una prenotazione. */
function collectServiceNames(booking) {
  if (!booking) return [];
  const out = [];
  const push = v => { if (v) out.push(v); };
  push(booking.serviceTitle);
  push(booking.optionName);
  push(booking.customServiceName);
  push(booking.categoryName);
  push(booking.category);
  if (Array.isArray(booking.services)) {
    booking.services.forEach(s => {
      push(s.name); push(s.title); push(s.serviceName);
      push(s.optionName); push(s.categoryName); push(s.category);
    });
  }
  if (booking.linkedPackage) {
    push(booking.linkedPackage.serviceTitle);
    push(booking.linkedPackage.serviceName);
    push(booking.linkedPackage.packageName);
  }
  return out;
}

/** True quando la prenotazione include un servizio di epilazione laser. */
export function isLaserBooking(booking) {
  return collectServiceNames(booking).some(n => norm(n).includes(LASER_SERVICE_MATCH));
}

// ── Formattazione data / ora ─────────────────────────────────────────

function formatItalianDate(date) {
  return date.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(date) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// ── Template dei messaggi ────────────────────────────────────────────

function buildNormalMessage(dateStr, timeStr) {
  return (
    `Ciao! Ti aspetto ${dateStr} alle ore ${timeStr}\n` +
    `in ${SALON_ADDRESS}.\n` +
    `A presto!`
  );
}

function buildLaserMessage(dateStr, timeStr) {
  return (
    `Ciao!\n` +
    `Ti aspetto ${dateStr}, alle ore ${timeStr} in ${SALON_ADDRESS}.\n` +
    `Ti ricordo di radere la zona da trattare il giorno prima del trattamento laser.\n` +
    `Inoltre, ti chiedo gentilmente di avvisarmi in caso di:\n` +
    `• assunzione di farmaci fotosensibilizzanti\n` +
    `• malattie autoimmuni\n` +
    `• lesioni cutanee (es. dermatiti, psoriasi, ecc.)\n` +
    `• gravidanza o allattamento\n` +
    `• intervento tumorale (non prima di 5 anni)\n` +
    `• anestesia recente (non prima di 6 mesi)\n` +
    `A presto!`
  );
}

/** Costruisce il messaggio di promemoria corretto per una prenotazione. */
export function buildReminderMessage(booking) {
  const start = new Date(booking.startTime);
  const dateStr = formatItalianDate(start);
  const timeStr = formatTime(start);
  return isLaserBooking(booking)
    ? buildLaserMessage(dateStr, timeStr)
    : buildNormalMessage(dateStr, timeStr);
}
