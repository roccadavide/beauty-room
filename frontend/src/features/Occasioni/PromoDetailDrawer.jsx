import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import PromoCountdown from "./PromoCountdown";

const getDiscountLabel = promo => {
  if (!promo) return null;
  if (promo.discountType === "PERCENTAGE") return `-${promo.discountValue}%`;
  if (promo.discountType === "FIXED") return `-€${Number(promo.discountValue).toFixed(0)}`;
  return null;
};

const getTotalOriginalPrice = (promo, products, services) => {
  if (!promo) return 0;
  const pidSet = new Set((promo.productIds ?? []).map(String));
  const sidSet = new Set((promo.serviceIds ?? []).map(String));
  const pSum = products
    .filter(p => pidSet.has(String(p.productId)))
    .reduce((s, p) => s + (p.price || 0), 0);
  const sSum = services
    .filter(s => sidSet.has(String(s.serviceId)))
    .reduce((s, sv) => s + (sv.price || 0), 0);
  return pSum + sSum;
};

const getDiscountedPrice = (original, discountType, discountValue) => {
  if (!original || !discountType || !discountValue) return original;
  if (discountType === "PERCENTAGE") return original - (original * discountValue) / 100;
  if (discountType === "FIXED") return original - discountValue;
  return original;
};

export default function PromoDetailDrawer({
  show,
  onHide,
  promo,
  products,
  services,
  onBooking,
  showCancelBanner = false,
}) {
  const navigate = useNavigate();
  const isExpired = promo?.endDate && new Date(promo.endDate) < new Date();
  const discount = getDiscountLabel(promo);

  // BUG #2 fix: normalizza a stringa per evitare type-mismatch numero/stringa
  const serviceIdSet = new Set((promo?.serviceIds ?? []).map(String));
  const productIdSet = new Set((promo?.productIds ?? []).map(String));

  const includedServices = services.filter(s => serviceIdSet.has(String(s.serviceId)));
  const includedProducts = products.filter(p => productIdSet.has(String(p.productId)));

  const hasServices = includedServices.length > 0;
  const hasProducts = includedProducts.length > 0;

  const totalOriginal = getTotalOriginalPrice(promo, products, services);
  const totalDiscounted =
    totalOriginal && promo
      ? getDiscountedPrice(totalOriginal, promo.discountType, promo.discountValue)
      : null;

  // Prezzo promozionale da passare al flusso di prenotazione
  const promoServicePrice = (() => {
    if (!totalDiscounted || includedServices.length === 0) return null;
    if (includedServices.length === 1 && includedProducts.length === 0) {
      return totalDiscounted;
    }
    const serviceTotal = includedServices.reduce((s, sv) => s + (sv.price || 0), 0);
    const productTotal = includedProducts.reduce((s, p) => s + (p.price || 0), 0);
    const grandTotal = serviceTotal + productTotal;
    if (!grandTotal) return null;
    return totalDiscounted * (serviceTotal / grandTotal);
  })();

  // BUG #1 fix: portale su document.body — position:fixed è sempre relativo al viewport
  return createPortal(
    <>
      {show && <div className="pd-backdrop" onClick={onHide} />}
      <div className={`pd-drawer ${show ? "pd-drawer--open" : ""}`}>
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
          <button className="pd-close-btn" onClick={onHide}>✕</button>
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
            <PromoCountdown endDate={promo.endDate} />
          )}
        </div>

        <div className="pd-footer">
          {hasServices && (
            <button
              className="pd-cta-primary"
              onClick={() => onBooking(includedServices[0], totalDiscounted, promo.promotionId, includedProducts)}
            >
              Prenota ora →
            </button>
          )}
          {hasProducts && (
            <button
              className="pd-cta-secondary"
              onClick={() => { onHide(); navigate("/prodotti"); }}
            >
              Vai ai prodotti
            </button>
          )}
          {!hasServices && !hasProducts && (
            <button className="pd-cta-primary" onClick={onHide}>
              Scopri di più →
            </button>
          )}
          {hasServices && hasProducts && (
            <p className="pd-mixed-note">
              Il prodotto incluso verrà consegnato il giorno del trattamento.
            </p>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
