import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import BookingRouteShell from "../features/bookings/BookingRouteShell";
import openBookingSurface from "../features/bookings/openBookingSurface";
import { createCheckoutSession, createCheckoutSessionGuest } from "../api/modules/stripe.api";
import { createOrderPayInStore } from "../api/modules/orders.api";
import { BookingFlow } from "../features/bookings/BookingModal";
import { MultiServiceBookingFlow } from "../features/bookings/MultiServiceBookingModal";
import { PayNowFlow } from "../features/products/PayNowModal";
import { CheckoutFlow } from "../features/cart/CheckoutModal";
import { PromoDetailFlow } from "../features/Occasioni/PromoDetailDrawer";

// The booking/purchase surface as a real route, for virtual-keyboard devices.
// Reads the typed descriptor from location.state.booking ({ type, ...props }) and
// renders the SAME *Flow component used by the desktop drawers, inside
// BookingRouteShell. Triggers push here on touch; every close is navigate(-1).
// The checkout callbacks reconstructed here call the SAME stripe/orders APIs with
// the SAME payloads the flows build — no booking/payload logic is rewritten.
export default function BookingRoutePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, accessToken } = useSelector(state => state.auth);
  const booking = location.state?.booking;

  // Bare URL / shared link with no descriptor → nothing to render.
  if (!booking) return <Navigate to="/" replace />;

  // Close = pop one history entry, mirroring the desktop drawer stack
  // (booking-over-promo). Guard the edge where /prenota is the first entry
  // (reload/share) so we never get stuck on a route with no "back".
  const close = () => (location.key === "default" ? navigate("/", { replace: true }) : navigate(-1));

  switch (booking.type) {
    case "service":
      return (
        <BookingFlow
          Shell={BookingRouteShell}
          mode="route"
          onClose={close}
          service={booking.service}
          initialOptionId={booking.initialOptionId ?? null}
          initialOption={booking.initialOption ?? null}
          promoPrice={booking.promoPrice ?? null}
          promotionId={booking.promotionId ?? null}
          promoProducts={booking.promoProducts ?? []}
          prefill={booking.prefill ?? null}
        />
      );

    case "multi":
      return <MultiServiceBookingFlow Shell={BookingRouteShell} onClose={close} services={booking.services} products={booking.products ?? []} />;

    case "product":
      return (
        <PayNowFlow
          Shell={BookingRouteShell}
          onClose={close}
          product={booking.product}
          qty={booking.qty}
          user={user}
          accessToken={accessToken}
          onCheckoutAuth={async orderData => {
            const { url } = await createCheckoutSession(orderData);
            window.location.href = url;
          }}
          onCheckoutGuest={async orderData => {
            const res = await createCheckoutSessionGuest(orderData);
            window.location.href = res.url;
          }}
          onCheckoutPayInStore={async orderData => {
            await createOrderPayInStore(orderData);
            window.location.href = "/area-personale?orderPayInStore=1";
          }}
        />
      );

    case "cart":
      return (
        <CheckoutFlow
          Shell={BookingRouteShell}
          onClose={close}
          cartItems={booking.cartItems}
          totalPrice={booking.totalPrice}
          onConfirm={async orderData => {
            const res = await createCheckoutSessionGuest({ ...orderData, pickupNote: booking.note ?? orderData.pickupNote });
            window.location.href = res.url;
          }}
        />
      );

    case "promo":
      return (
        <BookingRouteShell bare onHide={close}>
          <PromoDetailFlow
            promo={booking.promo}
            products={booking.products ?? []}
            services={booking.services ?? []}
            showCancelBanner={booking.showCancelBanner ?? false}
            onClose={close}
            onBook={(service, promoPrice, promotionId, promoProducts) =>
              navigate(...openBookingSurface({ type: "service", service, promoPrice, promotionId, promoProducts }))
            }
            onGoProducts={() => navigate("/prodotti")}
          />
        </BookingRouteShell>
      );

    default:
      return <Navigate to="/" replace />;
  }
}
