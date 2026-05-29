// Single source of truth for the booking-surface route + how triggers open it
// on virtual-keyboard devices. The descriptor carries everything the route needs
// to render the right *Flow: { type, ...props }. type ∈
// "service" | "product" | "cart" | "multi" | "promo".
//
// Usage at a trigger:  navigate(...openBookingSurface({ type: "service", service }))
// (every open is a push; every close is navigate(-1) — see BookingRoutePage).
export const BOOKING_ROUTE = "/prenota";

export default function openBookingSurface(descriptor) {
  return [BOOKING_ROUTE, { state: { booking: descriptor } }];
}
