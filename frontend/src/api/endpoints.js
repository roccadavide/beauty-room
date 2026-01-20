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

// ---- BOOKINGS (PUBLIC) ----
export const BOOKING_ENDPOINTS = {
  BASE: "/bookings",
  ME: "/bookings/me",
  BY_ID: id => `/bookings/${id}`,
};

// ---- BOOKINGS (ADMIN) ----
export const BOOKING_ENDPOINTS_ADMIN = {
  BASE: "/admin/bookings",
  BY_ID: id => `/admin/bookings/${id}`,
  BY_EMAIL: "/admin/bookings/by-email", // params: { email }
  DAY: "/admin/bookings/day", // params: { date }
  RANGE: "/admin/bookings/range", // params: { from, to }
  STATUS: id => `/admin/bookings/${id}/status`, // params: { status }
};

// ---- ORDERS ----
export const ORDER_ENDPOINTS = {
  BASE: "/orders",
  BY_ID: id => `/orders/${id}`,
  BY_EMAIL: email => `/orders/email/${email}`,
  ME: "/orders/me",
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
  CHECKOUT_BOOKING: "/checkout/bookings/create-session",
  CHECKOUT_BOOKING_GUEST: "/checkout/bookings/create-session-guest",
  ORDER_SUMMARY: "/checkout/order-summary",
  BOOKING_SUMMARY: "/checkout/bookings/booking-summary",
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

// ---- AGENDA ----

export const AGENDA_ENDPOINTS = {
  TIMELINE_DAY: "/availabilities/admin/timeline/day",
  BOOKINGS_DAY: "/admin/bookings/day",
  BOOKINGS_RANGE: "/admin/bookings/range",

  BOOKINGS_BASE: "/admin/bookings",
  BOOKING_BY_ID: id => `/admin/bookings/${id}`,
  BOOKING_STATUS: id => `/admin/bookings/${id}/status`,
};

export const AVAIL_ENDPOINTS = {
  SERVICE_SLOTS: serviceId => `/availabilities/services/${serviceId}`, // ?date=YYYY-MM-DD
};
