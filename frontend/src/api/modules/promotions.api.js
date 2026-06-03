import http from "../httpClient";
import { PROMOTION_ENDPOINTS } from "../endpoints";

// ---------------------------------- PROMOTIONS ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchPromotions = async (page = 0, size = 40, sort = "priority", includeInactive = false) => {
  const params = includeInactive ? { page, size, sort, includeInactive: true } : { page, size, sort };
  const { data } = await http.get(PROMOTION_ENDPOINTS.BASE, { params });
  return data?.content ?? [];
};

export const fetchActivePromotions = async () => {
  const { data } = await http.get(PROMOTION_ENDPOINTS.ACTIVE);
  return data ?? [];
};

export const fetchPromotionById = async id => {
  const { data } = await http.get(PROMOTION_ENDPOINTS.BY_ID(id));
  return data;
};

// -------------------------- CREATE --------------------------
export const createPromotion = async (payload, files = {}, token) => {
  const fd = new FormData();
  fd.append("data", new Blob([JSON.stringify(payload)], { type: "application/json" }));
  if (files.bannerImage) fd.append("bannerImage", files.bannerImage);
  if (files.cardImage) fd.append("cardImage", files.cardImage);

  const { data } = await http.post(PROMOTION_ENDPOINTS.BASE, fd, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// -------------------------- UPDATE --------------------------
export const updatePromotion = async (promotionId, payload, files = {}, token) => {
  const fd = new FormData();
  fd.append("data", new Blob([JSON.stringify(payload)], { type: "application/json" }));
  if (files.bannerImage) fd.append("bannerImage", files.bannerImage);
  if (files.cardImage) fd.append("cardImage", files.cardImage);

  const { data } = await http.put(PROMOTION_ENDPOINTS.BY_ID(promotionId), fd, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// -------------------------- DELETE --------------------------
export const deletePromotion = async (promotionId, token) => {
  await http.delete(PROMOTION_ENDPOINTS.BY_ID(promotionId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return true;
};

// -------------------------- PRODUCT-PROMO CHECKOUT --------------------------
// Product-only promo → direct Stripe Checkout for the bundle at the server-computed
// rounded price. Returns { url } (same shape as stripe.api createCheckoutSession).
export const createPromoCheckout = async (promotionId, accessToken) => {
  try {
    const { data } = await http.post(
      `${PROMOTION_ENDPOINTS.BY_ID(promotionId)}/checkout`,
      {},
      accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};
