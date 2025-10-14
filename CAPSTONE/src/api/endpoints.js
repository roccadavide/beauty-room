const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ---- AUTH ----
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE}/auth/login`,
  REGISTER: `${API_BASE}/auth/register`,
};

// ---- USERS ----
export const USER_ENDPOINTS = {
  BASE: `${API_BASE}/users`,
  ME: `${API_BASE}/users/me`,
  BY_EMAIL: email => `${API_BASE}/users/email/${email}`,
  BY_ID: id => `${API_BASE}/users/${id}`,
  MAKE_ADMIN: id => `${API_BASE}/users/${id}/make-admin`,
  REMOVE_ADMIN: id => `${API_BASE}/users/${id}/remove-admin`,
  CHANGE_PASSWORD: id => `${API_BASE}/users/${id}/password`,
};

// ---- CATEGORIES ----
export const CATEGORY_ENDPOINTS = {
  BASE: `${API_BASE}/categories`,
  BY_ID: id => `${API_BASE}/categories/${id}`,
};

// ---- SERVICES ----
export const SERVICE_ENDPOINTS = {
  BASE: `${API_BASE}/service-items`,
  BY_ID: id => `${API_BASE}/service-items/${id}`,
};

// ---- BOOKINGS ----
export const BOOKING_ENDPOINTS = {
  BASE: `${API_BASE}/bookings`,
  BY_ID: id => `${API_BASE}/bookings/${id}`,
  BY_EMAIL: email => `${API_BASE}/bookings/email/${email}`,
  STATUS: id => `${API_BASE}/bookings/${id}/status`,
};

// ---- ORDERS ----
export const ORDER_ENDPOINTS = {
  BASE: `${API_BASE}/orders`,
  BY_ID: id => `${API_BASE}/orders/${id}`,
};

// ---- PRODUCTS ----
export const PRODUCT_ENDPOINTS = {
  BASE: `${API_BASE}/products`,
  BY_ID: id => `${API_BASE}/products/${id}`,
};

// ---- AVAILABILITIES ----
export const AVAILABILITY_ENDPOINTS = {
  BASE: `${API_BASE}/availabilities`,
  SERVICE_DAY: (serviceId, date) => `${API_BASE}/availabilities/services/${serviceId}?date=${date}`,
};

// ---- STRIPE ----
export const STRIPE_ENDPOINTS = {
  CHECKOUT: `${API_BASE}/checkout/create-session`,
  WEBHOOK: `${API_BASE}/stripe/webhook`,
};

// ---- RESULTS ----
export const RESULT_ENDPOINTS = {
  BASE: `${API_BASE}/results`,
  BY_ID: id => `${API_BASE}/results/${id}`,
};

// ---- CLOSURES ----
export const CLOSURE_ENDPOINTS = {
  BASE: `${API_BASE}/closures`,
  BY_ID: id => `${API_BASE}/closures/${id}`,
};

// ---- WORKING HOURS ----
export const WORKING_HOURS_ENDPOINTS = {
  BASE: `${API_BASE}/working-hours`,
  BY_DAY: day => `${API_BASE}/working-hours/${day}`,
};

// ---- UTILS ----
export const UTILS = {
  IMAGE_PLACEHOLDER: "/assets/placeholder.jpg",
  DEFAULT_HEADERS: { "Content-Type": "application/json" },
};
