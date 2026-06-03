import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import useLenisModalLock from "../../hooks/useLenisModalLock";
import PromoCountdown from "./PromoCountdown";
import PromoUrgencyClock from "./PromoUrgencyClock";
import { computePromoPricing, computeServicePromoPrice } from "../../utils/promoPricing";
import { createPromoCheckout } from "../../api/modules/promotions.api";

const getDiscountLabel = promo => {
  if (!promo) return null;
  if (promo.discountType === "PERCENTAGE") return `-${promo.discountValue}%`;
  if (promo.discountType === "FIXED") return `-€${Number(promo.discountValue).toFixed(0)}`;
  return null;
};

// PromoDetailFlow = the SAME promo content rendered in both modes. Desktop keeps
// the custom .pd-drawer portal (below) wrapping this — zero visual change. The
// touch route renders this inside BookingRouteShell (bare). The content brings
// its own banner header + ✕, so callbacks are injected:
//   onClose       — dismiss the surface
//   onBook(service, promoPrice, promotionId, promoProducts) — same args as the old onBooking
//   onBuyPromo    — start Stripe checkout for a product-only promo bundle
export function PromoDetailFlow({ promo, products, services, showCancelBanner = false, onClose, onBook, onBuyPromo }) {
  const isExpired = promo?.endDate && new Date(promo.endDate) < new Date();
  const discount = getDiscountLabel(promo);

  // BUG #2 fix: normalizza a stringa per evitare type-mismatch numero/stringa
  const serviceIdSet = new Set((promo?.serviceIds ?? []).map(String));
  const productIdSet = new Set((promo?.productIds ?? []).map(String));

  const includedServices = services.filter(s => serviceIdSet.has(String(s.serviceId)));
  const includedProducts = products.filter(p => productIdSet.has(String(p.productId)));

  const hasServices = includedServices.length > 0;
  const hasProducts = includedProducts.length > 0;

  const { totalOriginal, totalDiscounted } = computePromoPricing(promo, products, services);

  // Importo addebitato alla prenotazione: mirror esatto del backend
  // (computeServerPromoPrice). Per le promo MIXED include il prodotto, che si
  // ritira il giorno dell'appuntamento. La card mostra invece il valore intero
  // dell'offerta (totalDiscounted); solo il BookingModal deve eguagliare l'addebito.
  const serviceChargePrice = computeServicePromoPrice(promo, services, products);

  return (
    <>
      <div className="pd-header-img">
          <img
            src={
              promo?.bannerImageUrl ||
              promo?.cardImageUrl ||
              "/assets/placeholder.jpg"
            }
            alt={promo?.title}
          />
          <div className="pd-header-gradient" />
          <button className="pd-close-btn" onClick={onClose}>✕</button>
          {discount && <span className="pcn-badge-discount">{discount}</span>}
        </div>

        <div className="pd-body">
          {showCancelBanner && (
            <div className="pd-cancel-banner">
              <span className="pd-cancel-banner__icon">↩</span>
              <span>Pagamento annullato — nessun addebito effettuato. Puoi riprovare quando vuoi.</span>
            </div>
          )}
          <p className="pcn-eyebrow">{promo?.subtitle || "Promozione"}</p>
          <h2 className="pd-title">{promo?.title}</h2>
          {promo?.description && (
            <p className="pd-description">{promo.description}</p>
          )}

          {(includedServices.length > 0 || includedProducts.length > 0) && (
            <div className="pd-includes-box">
              <p className="pd-includes-label">Cosa include</p>
              {includedServices.map(s => (
                <p key={s.serviceId} className="pd-includes-item">
                  • {s.title}
                </p>
              ))}
              {includedProducts.map(p => (
                <p key={p.productId} className="pd-includes-item">
                  • {p.name}
                  {hasServices && hasProducts && (
                    <span className="pd-pickup-note">
                      {" "}(ritiro il giorno del trattamento)
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}

          {totalOriginal > 0 && totalDiscounted && (
            <div className="pd-prices">
              <span className="pcn-price-orig">
                {totalOriginal.toLocaleString("it-IT", {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
              <span className="pd-price-disc">
                {totalDiscounted.toLocaleString("it-IT", {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
              <span className="pcn-savings-pill">
                Risparmi{" "}
                {(totalOriginal - totalDiscounted).toLocaleString("it-IT", {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
            </div>
          )}

          {promo?.endDate && !isExpired && (
            <div className="puc-row">
              <PromoUrgencyClock endDate={promo.endDate} />
              <PromoCountdown endDate={promo.endDate} />
            </div>
          )}
        </div>

        <div className="pd-footer">
          {hasServices && (
            <button
              className="pd-cta-primary"
              onClick={() => onBook(includedServices[0], serviceChargePrice, promo.promotionId, includedProducts)}
            >
              Prenota ora →
            </button>
          )}
          {!hasServices && hasProducts && (
            <button className="pd-cta-primary" onClick={onBuyPromo}>
              Compra ora la promozione →
            </button>
          )}
          {!hasServices && !hasProducts && (
            <button className="pd-cta-primary" onClick={onClose}>
              Scopri di più →
            </button>
          )}
          {hasServices && hasProducts && (
            <p className="pd-mixed-note">Il prodotto incluso lo ritiri il giorno dell&apos;appuntamento.</p>
          )}
        </div>
    </>
  );
}

// Desktop wrapper — custom side-drawer portal, visuals unchanged. The touch
// route renders <PromoDetailFlow/> inside BookingRouteShell (bare) instead.
export default function PromoDetailDrawer({ show, onHide, promo, products, services, onBooking, showCancelBanner = false }) {
  const { accessToken } = useSelector(s => s.auth);
  // Lock Lenis while the drawer is open.
  useLenisModalLock(show);
  return createPortal(
    <>
      {show && <div className="pd-backdrop" onClick={onHide} />}
      <div className={`pd-drawer ${show ? "pd-drawer--open" : ""}`}>
        <PromoDetailFlow
          promo={promo}
          products={products}
          services={services}
          showCancelBanner={showCancelBanner}
          onClose={onHide}
          onBook={onBooking}
          onBuyPromo={async () => {
            const res = await createPromoCheckout(promo.promotionId, accessToken);
            if (res?.url) window.location.assign(res.url);
          }}
        />
      </div>
    </>,
    document.body,
  );
}
