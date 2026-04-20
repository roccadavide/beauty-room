import { Card, Col } from "react-bootstrap";
import AdminToggle from "../../components/common/AdminToggle";
import { EditButton, DeleteButton } from "../../components/common/AdminActionButtons";
import { BadgeFlags } from "../../components/common/BadgeFlag";
import { usePrefetch } from "../../hooks/usePrefetch";
import { fetchProductById } from "../../api/modules/products.api";
import CategoryBadge from "../../components/common/CategoryBadge";

function ProductCard({ p, isAdmin, categoriesMap, onCardClick, onEdit, onDelete, onToggleActive }) {
  const { onMouseEnter, onMouseLeave } = usePrefetch(() => fetchProductById(p.productId));

  return (
    <Col xs={12} sm={6} lg={6} xl={4} className="d-flex">
      <Card
        className={`br-card beauty-product-card h-100${p.stock === 0 ? " bpc--sold-out" : ""}${isAdmin && !(p.active ?? true) ? " admin-entity--inactive" : ""}`}
        onClick={onCardClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {isAdmin && (
          <div className="admin-card-toggle-corner" onClick={e => e.stopPropagation()}>
            <AdminToggle
              entityId={p.productId}
              isActive={p.active ?? true}
              endpoint="/products"
              onToggleSuccess={onToggleActive}
            />
          </div>
        )}
        <div className="bpc-img-wrap">
          <Card.Img src={p.images?.[0]} alt={p.name} />
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
    </Col>
  );
}

export default ProductCard;
