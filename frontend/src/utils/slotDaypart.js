// Daypart grouping for booking time-slots.
// Shared by every slot-picker drawer so the buckets, their boundaries and their
// labels stay identical everywhere and are tunable in ONE place.
//
// Display-only: this never changes which slots exist, their order, availability
// or selection — it only buckets an already-built slot array for rendering.

// Boundary hours (24h clock):
//   Mattina    = start <  13:00
//   Pomeriggio = 13:00 <= start < 18:00
//   Sera       = start >= 18:00
export const AFTERNOON_START_HOUR = 13;
export const EVENING_START_HOUR = 18;

// Section order + Italian labels. Drawers map over this so order/labels agree.
export const DAYPARTS = [
  { key: "morning", label: "Mattina" },
  { key: "afternoon", label: "Pomeriggio" },
  { key: "evening", label: "Sera" },
];

const AFTERNOON_START_MIN = AFTERNOON_START_HOUR * 60;
const EVENING_START_MIN = EVENING_START_HOUR * 60;

// Minutes-since-midnight for a "HH:MM" start string. Returns -1 if unparseable.
function startToMinutes(start) {
  if (typeof start !== "string") return -1;
  const m = start.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Default start accessor: handles a plain "HH:MM" string OR an object with .start.
function defaultGetStart(slot) {
  return typeof slot === "string" ? slot : slot?.start;
}

/**
 * Bucket a pre-built slot array into { morning, afternoon, evening }, preserving
 * the input order within each bucket. Robust to both string slots ("HH:MM") and
 * object slots ({ start, ... }). Never drops a slot: an unparseable start falls
 * into "morning", so the three buckets always partition the input exactly.
 *
 * @param {Array} slots
 * @param {(slot: any) => string} [getStart]
 * @returns {{ morning: any[], afternoon: any[], evening: any[] }}
 */
export function groupSlotsByDaypart(slots, getStart = defaultGetStart) {
  const morning = [];
  const afternoon = [];
  const evening = [];
  for (const slot of slots ?? []) {
    const mins = startToMinutes(getStart(slot));
    if (mins >= EVENING_START_MIN) evening.push(slot);
    else if (mins >= AFTERNOON_START_MIN) afternoon.push(slot);
    else morning.push(slot); // includes unparseable (-1) → never dropped
  }
  return { morning, afternoon, evening };
}
