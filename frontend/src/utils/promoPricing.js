// Final promo prices round to the nearest 0.50 € (premium clean pricing).
export const PROMO_ROUNDING_STEP = 0.5;

export function roundPromoPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return value;
  return Math.round(Number(value) / PROMO_ROUNDING_STEP) * PROMO_ROUNDING_STEP;
}

// Normalized id matching (adopts the PromoDetailDrawer version — the "BUG #2 fix").
export function getTotalOriginalPrice(promo, products = [], services = []) {
  if (!promo) return 0;
  const pidSet = new Set((promo.productIds ?? []).map(String));
  const sidSet = new Set((promo.serviceIds ?? []).map(String));
  const pSum = products.filter(p => pidSet.has(String(p.productId))).reduce((s, p) => s + (p.price || 0), 0);
  const sSum = services.filter(s => sidSet.has(String(s.serviceId))).reduce((s, sv) => s + (sv.price || 0), 0);
  return pSum + sSum;
}

export function getRawDiscountedPrice(original, discountType, discountValue) {
  if (!original || !discountType || !discountValue) return original;
  if (discountType === "PERCENTAGE") return original - (original * discountValue) / 100;
  if (discountType === "FIXED") return Math.max(0, original - discountValue);
  if (discountType === "PRICE_OVERRIDE") return Number(discountValue);
  return original;
}

// Canonical FE entry point: rounded totals for cards, detail, admin preview.
export function computePromoPricing(promo, products = [], services = []) {
  const totalOriginal = getTotalOriginalPrice(promo, products, services);
  const raw = totalOriginal ? getRawDiscountedPrice(totalOriginal, promo?.discountType, promo?.discountValue) : null;
  const totalDiscounted = raw != null ? roundPromoPrice(raw) : null;
  const savings = totalOriginal && totalDiscounted != null ? totalOriginal - totalDiscounted : null;
  return { totalOriginal, totalDiscounted, savings };
}
