import PromoCountdown from "./PromoCountdown";
import AdminToggle from "../../components/common/AdminToggle";
import { EditButton, DeleteButton } from "../../components/common/AdminActionButtons";

export default function PromoCard({
  promo,
  totalOriginal,
  totalDiscounted,
  isAdmin,
  onEdit,
  onDelete,
  onClick,
  onToggle,
}) {
  const isExpired = promo.endDate && new Date(promo.endDate) < new Date();
  const discount =
    promo.discountType === "PERCENTAGE"
      ? `-${promo.discountValue}%`
      : promo.discountType === "FIXED"
      ? `-€${Number(promo.discountValue).toFixed(0)}`
      : null;
  const savings =
    totalOriginal && totalDiscounted ? totalOriginal - totalDiscounted : null;
  const img =
    promo.cardImageUrl || promo.bannerImageUrl || "/assets/placeholder.jpg";

  return (
    <div
      className={`promo-card-new${isExpired && !isAdmin ? " promo-card-new--hidden" : ""}${isExpired ? " promo-card-new--expired" : ""}${isAdmin && !(promo.active ?? true) ? " admin-entity--inactive" : ""}`}
      onClick={() => onClick(promo)}
    >
      <div className="pcn-img-wrap">
        <img src={img} alt={promo.title} loading="lazy" />
        <div className="pcn-gradient" />
        {discount && <span className="pcn-badge-discount">{discount}</span>}
        {isAdmin && isExpired && (
          <span className="pcn-badge-expired">Scaduta</span>
        )}
        {isAdmin && !promo.active && !isExpired && (
          <span className="pcn-badge-inactive">Inattiva</span>
        )}
      </div>

      <div className="pcn-body">
        {promo.subtitle && <p className="pcn-eyebrow">{promo.subtitle}</p>}
        <h3 className="pcn-title">{promo.title}</h3>
        <div className="pcn-accent" />

        {totalOriginal > 0 && totalDiscounted && (
          <div className="pcn-prices">
            <span className="pcn-price-orig">
              {totalOriginal.toLocaleString("it-IT", {
                style: "currency",
                currency: "EUR",
              })}
            </span>
            <span className="pcn-price-disc">
              {totalDiscounted.toLocaleString("it-IT", {
                style: "currency",
                currency: "EUR",
              })}
            </span>
            {savings > 0 && (
              <span className="pcn-savings-pill">
                Risparmi{" "}
                {savings.toLocaleString("it-IT", {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
            )}
          </div>
        )}

        {promo.endDate && !isExpired && (
          <PromoCountdown endDate={promo.endDate} />
        )}

        <button
          className="pcn-cta-btn"
          onClick={e => {
            e.stopPropagation();
            onClick(promo);
          }}
        >
          Scopri l&apos;offerta →
        </button>

        {isAdmin && (
          <div className="pcn-admin-row">
            {onToggle && (
              <div onClick={e => e.stopPropagation()} style={{ marginBottom: "8px" }}>
                <AdminToggle
                  entityId={promo.promotionId}
                  isActive={promo.active ?? true}
                  endpoint="/promotions"
                  onToggleSuccess={newVal => onToggle(promo.promotionId, newVal)}
                />
              </div>
            )}
            <EditButton onClick={() => onEdit(promo)} />
            <DeleteButton onClick={() => onDelete(promo)} />
            {isExpired && (
              <button
                className="pcn-cta-btn pcn-cta-btn--ghost"
                onClick={e => {
                  e.stopPropagation();
                  onEdit(promo);
                }}
              >
                ↺ Riattiva
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
