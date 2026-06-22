import { useRef, useCallback } from "react";
import { Card, Col } from "react-bootstrap";
import AdminToggle from "../../components/common/AdminToggle";
import { EditButton, DeleteButton } from "../../components/common/AdminActionButtons";
import { BadgeFlags } from "../../components/common/BadgeFlag";
import { usePrefetch } from "../../hooks/usePrefetch";
import { fetchProductById } from "../../api/modules/products.api";
import CategoryBadge from "../../components/common/CategoryBadge";
import WishlistHeart from "../../components/common/WishlistHeart";
import { useLike } from "../../hooks/useLike";
import LikePill from "../../components/common/LikePill";
import LikeBurst from "../../components/common/LikeBurst";
import CardGlow from "../../components/common/CardGlow";

function ProductCard({
  p,
  isAdmin,
  categoriesMap,
  onCardClick,
  onEdit,
  onDelete,
  onToggleActive,
  sortableRef,
  sortableStyle,
  sortableClassName,
  sortableAttributes,
  sortableListeners,
  dataScrollId,
  reordering,
  isSelected,
  onTileTap,
}) {
  const { onMouseEnter, onMouseLeave } = usePrefetch(() => fetchProductById(p.productId));
  const { count, liked, burst, triggerLike, showHint } = useLike("PRODUCT", p.productId, p.likesCount ?? 0);

  const lastTapRef  = useRef(0);
  const navTimerRef = useRef(null);

  const handleCardClick = useCallback(() => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;

    if (delta < 350 && delta > 0) {
      clearTimeout(navTimerRef.current);
      triggerLike();
    } else {
      navTimerRef.current = setTimeout(() => {
        onCardClick?.();
      }, 360);
    }
  }, [triggerLike, onCardClick]);

  if (reordering) {
    return (
      <Col
        xs={6}
        sm={4}
        lg={3}
        xl={3}
        ref={sortableRef}
        className={`d-flex ${sortableClassName || ""}`.trim()}
        style={sortableStyle}
        data-scroll-id={dataScrollId}
        {...(sortableAttributes || {})}
        {...(sortableListeners || {})}
        onClick={() => onTileTap?.()}
      >
        <Card className={`br-card beauty-product-card ro-compact-card h-100${isSelected ? " ro-selected" : ""}`}>
          {isSelected && <span className="ro-selected-badge" aria-hidden="true">✓</span>}
          <span className="ro-drag-handle" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <g fill="currentColor">
                <circle cx="8" cy="5" r="1.5" /><circle cx="8" cy="11" r="1.5" /><circle cx="8" cy="17" r="1.5" />
                <circle cx="14" cy="5" r="1.5" /><circle cx="14" cy="11" r="1.5" /><circle cx="14" cy="17" r="1.5" />
              </g>
            </svg>
          </span>
          <div className="ro-compact-img">
            <img src={p.images?.[0]} alt={p.name} loading="lazy" />
          </div>
          <div className="ro-compact-title">{p.name}</div>
        </Card>
      </Col>
    );
  }

  return (
    <Col
      xs={12}
      sm={6}
      lg={6}
      xl={4}
      ref={sortableRef}
      className={`d-flex ${sortableClassName || ""}`.trim()}
      style={sortableStyle}
      data-scroll-id={dataScrollId}
      {...(sortableAttributes || {})}
    >
      <CardGlow enabled={p.highlightEnabled} color={p.highlightColor}>
      <Card
        className={`br-card beauty-product-card h-100${p.stock === 0 ? " bpc--sold-out" : ""}${isAdmin && !(p.active ?? true) ? " admin-entity--inactive" : ""}`}
        onClick={handleCardClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <WishlistHeart itemType="PRODUCT" itemId={p.productId} />
        {isAdmin && !(p.active ?? true) && <span className="bpc-inactive-badge">Inattivo</span>}
        <div className="bpc-img-wrap">
          {isAdmin && (
            <div className="admin-card-toggle-corner" style={{ position: "absolute", left: 10, bottom: 10, top: "auto", right: "auto" }} onClick={e => e.stopPropagation()}>
              <AdminToggle
                entityId={p.productId}
                isActive={p.active ?? true}
                endpoint="/products"
                onToggleSuccess={onToggleActive}
              />
            </div>
          )}
          <Card.Img src={p.images?.[0]} alt={p.name} />
          <LikeBurst active={burst} />
          <div className="bpc-img-overlay">
            <LikePill count={count} liked={liked} compact onClick={triggerLike} hint={showHint} />
          </div>
          {p.stock === 0 && (
            <div className="bpc-sold-out-overlay">
              <span className="bpc-sold-out-label">Esaurito</span>
            </div>
          )}
        </div>
        <BadgeFlags badges={p?.badges ?? []} />
        <Card.Body className="d-flex flex-column">
          <div className="bpc-accent-line" />
          <Card.Title className="bpc-title mb-1">{p.name}</Card.Title>
          <div className="mb-2 d-flex align-items-center gap-2">
            <CategoryBadge label={categoriesMap[p.categoryId] || ""} />
            <small className="text-muted">{p.stock > 0 ? `${p.stock} rimanenti` : "Esaurito"}</small>
          </div>
          <Card.Text className="flex-grow-1">{p.shortDescription}</Card.Text>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <span className="bpc-price">{p.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
            {p.stock === 0 && <span className="bpc-out-pill">Non disponibile</span>}
            {isAdmin && (
              <div className="d-flex gap-2 ms-auto">
                <EditButton onClick={onEdit} />
                <DeleteButton onClick={onDelete} />
              </div>
            )}
          </div>
        </Card.Body>
      </Card>
      </CardGlow>
    </Col>
  );
}

export default ProductCard;
