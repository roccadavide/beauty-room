/**
 * Format a monetary amount in euros, Italian style: comma decimals, dot thousands.
 * Cents are shown only when the amount is fractional (€9 stays "€9"; €8,90 shows
 * "€8,90"), so whole-euro services aren't cluttered with ".00" while product cents are
 * never rounded away. Returns "—" for null / undefined / NaN.
 */
export function formatEuro(amount) {
  if (amount == null) return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return "—";
  return `€${n.toLocaleString("it-IT", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
