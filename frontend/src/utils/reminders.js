// src/utils/reminders.js
// WhatsApp reminder helpers for the admin agenda. No external dependencies.

/** Indirizzo del salone — usato in ogni messaggio di promemoria. */
const SALON_ADDRESS = "Viale Risorgimento 587, Calusco d\u2019Adda";

/** Sottostringa (normalizzata) che identifica un servizio di epilazione laser. */
const LASER_SERVICE_MATCH = "epilazione laser";

/** Prefisso chiavi localStorage per i promemoria confermati. */
const STORAGE_PREFIX = "br:reminderSent:";

/** Rimuove all'avvio i promemoria confermati piu vecchi di N giorni. */
const PRUNE_AFTER_DAYS = 60;

// ── Normalizzazione numero di telefono ───────────────────────────────

/**
 * Normalizza un numero italiano nel formato richiesto da wa.me
 * (solo cifre, prefisso internazionale incluso, niente '+').
 * Es: "348 377 3264" -> "393483773264" ; "+39 348..." -> "39348..."
 */
export function normalizeItalianPhone(raw) {
  if (!raw) return "";
  let clean = String(raw).replace(/[^\d+]/g, "");
  if (clean.startsWith("+")) clean = clean.slice(1);
  if (clean.startsWith("00")) clean = clean.slice(2);
  // Gia con prefisso internazionale (39 + numero a 10+ cifre)
  if (clean.startsWith("39") && clean.length >= 11) return clean;
  // Cellulare italiano a 10 cifre senza prefisso (inizia con 3)
  if (clean.length === 10 && clean.startsWith("3")) return `39${clean}`;
  // Fallback: assicura comunque un prefisso
  return clean.startsWith("39") ? clean : `39${clean}`;
}

/** Costruisce un link wa.me con messaggio precompilato. */
export function buildWhatsAppUrl(phone, message) {
  return `https://wa.me/${normalizeItalianPhone(phone)}?text=${encodeURIComponent(message)}`;
}

// ── Rilevamento servizio laser ───────────────────────────────────────

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

/** Raccoglie ogni stringa "nome servizio" collegata a una prenotazione. */
function collectServiceNames(booking) {
  if (!booking) return [];
  const out = [];
  const push = v => {
    if (v) out.push(v);
  };
  push(booking.serviceTitle);
  push(booking.optionName);
  push(booking.customServiceName);
  push(booking.categoryName);
  push(booking.category);
  if (Array.isArray(booking.services)) {
    booking.services.forEach(s => {
      push(s.name);
      push(s.title);
      push(s.serviceName);
      push(s.optionName);
      push(s.categoryName);
      push(s.category);
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
  // es. "mercoledi 20 maggio"
  return date.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(date) {
  // es. "9:00" (senza zero iniziale, per rispettare lo stile di Michela)
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// ── Template dei messaggi ────────────────────────────────────────────

function buildNormalMessage(dateStr, timeStr) {
  return `Ciao! Ti aspetto ${dateStr} alle ore ${timeStr}\n` + `in ${SALON_ADDRESS}.\n` + `A presto! \uD83C\uDF38`;
}

function buildLaserMessage(dateStr, timeStr) {
  return (
    `Ciao! \uD83C\uDF38\n` +
    `Ti aspetto ${dateStr}, alle ore ${timeStr} in ${SALON_ADDRESS}.\n` +
    `Ti ricordo di radere la zona da trattare il giorno prima del trattamento laser.\n` +
    `Inoltre, ti chiedo gentilmente di avvisarmi in caso di:\n` +
    `\u2022 assunzione di farmaci fotosensibilizzanti\n` +
    `\u2022 malattie autoimmuni\n` +
    `\u2022 lesioni cutanee (es. dermatiti, psoriasi, ecc.)\n` +
    `\u2022 gravidanza o allattamento\n` +
    `\u2022 intervento tumorale (non prima di 5 anni)\n` +
    `\u2022 anestesia recente (non prima di 6 mesi)\n` +
    `A presto! \u2728`
  );
}

/** Costruisce il messaggio di promemoria corretto per una prenotazione. */
export function buildReminderMessage(booking) {
  const start = new Date(booking.startTime);
  const dateStr = formatItalianDate(start);
  const timeStr = formatTime(start);
  return isLaserBooking(booking) ? buildLaserMessage(dateStr, timeStr) : buildNormalMessage(dateStr, timeStr);
}

// ── Persistenza stato "inviato" (localStorage) ───────────────────────

function safeLocalStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null; // modalita privata / disabilitato
  }
}

/**
 * Carica la mappa dei promemoria confermati { [bookingId]: isoTimestamp },
 * eliminando le voci piu vecchie di PRUNE_AFTER_DAYS.
 */
export function loadReminderSentMap() {
  const ls = safeLocalStorage();
  if (!ls) return {};
  const map = {};
  const cutoff = Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const stale = [];
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    const iso = ls.getItem(key);
    const ts = iso ? Date.parse(iso) : NaN;
    if (Number.isFinite(ts) && ts >= cutoff) {
      map[key.slice(STORAGE_PREFIX.length)] = iso;
    } else {
      stale.push(key);
    }
  }
  stale.forEach(k => {
    try {
      ls.removeItem(k);
    } catch {
      /* ignore */
    }
  });
  return map;
}

export function persistReminderSent(bookingId, iso) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_PREFIX + bookingId, iso);
  } catch {
    /* quota */
  }
}

export function clearReminderSent(bookingId) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(STORAGE_PREFIX + bookingId);
  } catch {
    /* ignore */
  }
}
