import { Card, Badge, Col } from "react-bootstrap";
import AdminToggle from "../../components/common/AdminToggle";
import { EditButton, DeleteButton } from "../../components/common/AdminActionButtons";
import { BadgeFlags } from "../../components/common/BadgeFlag";
import { usePrefetch } from "../../hooks/usePrefetch";
import { fetchServiceById } from "../../api/modules/services.api";

function ServiceCard({ s, isAdmin, categoriesMap, categoryColorMap, onCardClick, onEdit, onDelete, onToggleActive }) {
  const activeOptions = s.options?.filter(o => o.active) ?? [];
  const hasActiveOptions = activeOptions.length > 0;
  const minOptionDuration = activeOptions.map(o => o.durationMin).filter(Boolean);
  const displayDuration = minOptionDuration.length > 0 ? Math.min(...minOptionDuration) : s.durationMin;
  const pricePrefix = hasActiveOptions ? "da " : "";
  const durationPrefix = hasActiveOptions ? "da " : "";

  const { onMouseEnter, onMouseLeave } = usePrefetch(() => fetchServiceById(s.serviceId));

  return (
    <Col xs={12} sm={6} lg={6} xl={4} className="d-flex">
      <Card
        className={`br-card beauty-service-card h-100${isAdmin && !(s.active ?? true) ? " admin-entity--inactive" : ""}`}
        onClick={onCardClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {isAdmin && (
          <div className="admin-card-toggle-corner" style={{ left: 10, right: "auto" }} onClick={e => e.stopPropagation()}>
            <AdminToggle
              entityId={s.serviceId}
              isActive={s.active ?? true}
              endpoint="/service-items"
              onToggleSuccess={onToggleActive}
            />
          </div>
        )}
        <div className="bsc-img-wrap">
          <Card.Img src={s.images?.[0]} alt={s.title} />
          <div className="bsc-img-overlay">
            <span className="bsc-duration">
              {durationPrefix}
              {displayDuration} min
            </span>
          </div>
        </div>
        <BadgeFlags badges={s?.badges ?? []} />
        <Card.Body className="d-flex flex-column">
          <div className="bsc-accent-line" />
          <Card.Title className="bsc-title mb-1">{s.title}</Card.Title>
          <div className="mb-2 d-flex align-items-center gap-2">
            <Badge bg={categoryColorMap[s.categoryId] || "secondary"} className="text-uppercase">
              {categoriesMap[s.categoryId] || "Senza categoria"}
            </Badge>
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
