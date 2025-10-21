// ---- AUTH ----
export const AUTH_ENDPOINTS = {
  LOGIN: "/auth/login",
  REGISTER: "/auth/register",
};

// ---- USERS ----
export const USER_ENDPOINTS = {
  BASE: "/users",
  ME: "/users/me",
  BY_EMAIL: email => `/users/email/${email}`,
  BY_ID: id => `/users/${id}`,
  MAKE_ADMIN: id => `/users/${id}/make-admin`,
  REMOVE_ADMIN: id => `/users/${id}/remove-admin`,
  CHANGE_PASSWORD: id => `/users/${id}/password`,
};

// ---- CATEGORIES ----
export const CATEGORY_ENDPOINTS = {
  BASE: "/categories",
  BY_ID: id => `/categories/${id}`,
};

// ---- SERVICES ----
export const SERVICE_ENDPOINTS = {
  BASE: "/service-items",
  BY_ID: id => `/service-items/${id}`,
};

// ---- BOOKINGS ----
export const BOOKING_ENDPOINTS = {
  BASE: "/bookings",
  BY_ID: id => `/bookings/${id}`,
  BY_EMAIL: email => `/bookings/email/${email}`,
  STATUS: id => `/bookings/${id}/status`,
};

// ---- ORDERS ----
export const ORDER_ENDPOINTS = {
  BASE: "/orders",
  BY_ID: id => `/orders/${id}`,
  BY_EMAIL: email => `/orders/email/${email}`,
};

// ---- PRODUCTS ----
export const PRODUCT_ENDPOINTS = {
  BASE: "/products",
  BY_ID: id => `/products/${id}`,
};

// ---- AVAILABILITIES ----
export const AVAILABILITY_ENDPOINTS = {
  BASE: "/availabilities",
  SERVICE_DAY: (serviceId, date) => `/availabilities/services/${serviceId}?date=${date}`,
};

// ---- STRIPE ----
export const STRIPE_ENDPOINTS = {
  CHECKOUT: "/checkout/create-session",
  CHECKOUT_GUEST: "/checkout/create-session-guest",
  ORDER_SUMMARY: "/checkout/order-summary",
  WEBHOOK: "/stripe/webhook",
};

// ---- RESULTS ----
export const RESULT_ENDPOINTS = {
  BASE: "/results",
  BY_ID: id => `/results/${id}`,
};

// ---- CLOSURES ----
export const CLOSURE_ENDPOINTS = {
  BASE: "/closures",
  BY_ID: id => `/closures/${id}`,
};

// ---- WORKING HOURS ----
export const WORKING_HOURS_ENDPOINTS = {
  BASE: "/working-hours",
  BY_DAY: day => `/working-hours/${day}`,
};

// ---- UTILS ----
export const UTILS = {
  IMAGE_PLACEHOLDER: "/assets/placeholder.jpg",
  DEFAULT_HEADERS: { "Content-Type": "application/json" },
};

// ---- PROMOTIONS ----
export const PROMOTION_ENDPOINTS = {
  BASE: "/promotions",
  BY_ID: id => `/promotions/${id}`,
  ACTIVE: "/promotions/active",
};
