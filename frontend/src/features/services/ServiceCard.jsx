import { useRef, useCallback } from "react";
import { Card, Col } from "react-bootstrap";
import AdminToggle from "../../components/common/AdminToggle";
import { EditButton, DeleteButton } from "../../components/common/AdminActionButtons";
import { BadgeFlags } from "../../components/common/BadgeFlag";
import { usePrefetch } from "../../hooks/usePrefetch";
import { fetchServiceById } from "../../api/modules/services.api";
import CategoryBadge from "../../components/common/CategoryBadge";
import WishlistHeart from "../../components/common/WishlistHeart";
import { useLike } from "../../hooks/useLike";
import LikePill from "../../components/common/LikePill";
import LikeBurst from "../../components/common/LikeBurst";

function ServiceCard({ s, isAdmin, categoriesMap, onCardClick, onEdit, onDelete, onToggleActive }) {
  const activeOptions = s.options?.filter(o => o.active) ?? [];
  const hasActiveOptions = activeOptions.length > 0;
  const minOptionDuration = activeOptions.map(o => o.durationMin).filter(Boolean);
  const displayDuration = minOptionDuration.length > 0 ? Math.min(...minOptionDuration) : s.durationMin;
  const pricePrefix = hasActiveOptions ? "da " : "";
  const durationPrefix = hasActiveOptions ? "da " : "";

  const { onMouseEnter, onMouseLeave } = usePrefetch(() => fetchServiceById(s.serviceId));
  const { count, liked, burst, triggerLike, showHint } = useLike("SERVICE", s.serviceId, s.likesCount ?? 0);

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

  return (
    <Col xs={12} sm={6} lg={6} xl={4} className="d-flex">
      <Card
        className={`br-card beauty-service-card h-100${isAdmin && !(s.active ?? true) ? " admin-entity--inactive" : ""}`}
        onClick={handleCardClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <WishlistHeart itemType="SERVICE" itemId={s.serviceId} />
        {isAdmin && !(s.active ?? true) && <span className="bsc-inactive-badge">Inattivo</span>}
        <div className="bsc-img-wrap">
          {isAdmin && (
            <div className="admin-card-toggle-corner" style={{ position: "absolute", left: 10, bottom: 10, top: "auto", right: "auto" }} onClick={e => e.stopPropagation()}>
              <AdminToggle entityId={s.serviceId} isActive={s.active ?? true} endpoint="/service-items" onToggleSuccess={onToggleActive} />
            </div>
          )}
          <Card.Img src={s.images?.[0]} alt={s.title} />
          <LikeBurst active={burst} />
          <div className="bsc-img-overlay">
            <LikePill count={count} liked={liked} compact onClick={triggerLike} hint={showHint} />
          </div>
        </div>
        <BadgeFlags badges={s?.badges ?? []} />
        <Card.Body className="d-flex flex-column">
          <div className="bsc-accent-line" />
          <Card.Title className="bsc-title mb-1">{s.title}</Card.Title>
          <div className="mb-2 d-flex align-items-center gap-2">
            <CategoryBadge label={categoriesMap[s.categoryId] || ""} />
            <small className="text-muted">
              {durationPrefix}
              {displayDuration} min
            </small>
          </div>
          <Card.Text className="flex-grow-1">{s.shortDescription}</Card.Text>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <span className="bsc-price">
              {pricePrefix}
              {s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
            </span>
            {isAdmin && (
              <div className="d-flex gap-2 ms-auto">
                <EditButton onClick={onEdit} />
                <DeleteButton onClick={onDelete} />
              </div>
            )}
          </div>
        </Card.Body>
      </Card>
    </Col>
  );
}

export default ServiceCard;
