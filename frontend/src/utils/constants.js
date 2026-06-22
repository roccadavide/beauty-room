// Brand constants — single source of truth for contact/social info on the frontend
export const BRAND_WHATSAPP = "393780921723"; // E.164 senza +, per wa.me/
export const BRAND_PHONE_LABEL = "+39 378 092 1723";
export const BRAND_EMAIL = "rossimichela.pmu@gmail.com";
export const BRAND_NAME = "Beauty Room";

// Must match app.booking.max-advance-days in the backend (150).
// No public config endpoint exists — keep in sync manually.
export const BOOKING_MAX_ADVANCE_DAYS = 150;

// Feature flag — public "Occasioni" page (packages/promotions). Default OFF and
// load-bearing: when the env var is absent or not exactly "true", Occasioni is
// locked (coming-soon page + dimmed nav entry). To reopen, set
// VITE_FEATURE_OCCASIONI_ENABLED=true in the environment — no code change.
export const FEATURE_OCCASIONI_ENABLED = import.meta.env.VITE_FEATURE_OCCASIONI_ENABLED === "true";
