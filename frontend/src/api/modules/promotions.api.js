import http from "../httpClient";
import { PROMOTION_ENDPOINTS } from "../endpoints";

// ---------------------------------- PROMOTIONS ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchPromotions = async (page = 0, size = 40, sort = "priority") => {
  const { data } = await http.get(PROMOTION_ENDPOINTS.BASE, { params: { page, size, sort } });
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
