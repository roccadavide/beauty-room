/**
 * Format a duration given in minutes as a human-readable string.
 * Designed for display only — do not use for arithmetic.
 *
 * Examples:
 *   0    -> "0 min"
 *   5    -> "5 min"
 *   45   -> "45 min"
 *   60   -> "1h"
 *   80   -> "1h 20min"
 *   100  -> "1h 40min"
 *   180  -> "3h"
 *   null -> "0 min"
 */
export default function formatDuration(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n) || n <= 0) return "0 min";
  const total = Math.round(n);
  const h = Math.floor(total / 60);
  const r = total % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}min`;
}
