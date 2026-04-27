import http from "../httpClient";
import { WISHLIST_ENDPOINTS } from "../endpoints";

// -------------------------- GET WISHLIST --------------------------
export const fetchWishlist = async () => {
  const { data } = await http.get(WISHLIST_ENDPOINTS.BASE);
  return data;
};

// -------------------------- CHECK SINGLE ITEM --------------------------
export const checkWishlisted = async (itemType, itemId) => {
  const { data } = await http.get(WISHLIST_ENDPOINTS.CHECK, {
    params: { itemType, itemId },
  });
  return data.wishlisted;
};

// -------------------------- TOGGLE --------------------------
export const toggleWishlist = async (itemType, itemId) => {
  const { data } = await http.post(WISHLIST_ENDPOINTS.TOGGLE, { itemType, itemId });
  return data; // { wishlisted: boolean, message: string }
};

// -------------------------- STATS (admin) --------------------------
export const fetchWishlistStats = async () => {
  const { data } = await http.get(WISHLIST_ENDPOINTS.STATS);
  return data;
};
