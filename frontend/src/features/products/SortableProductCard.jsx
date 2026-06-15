import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ProductCard from "./ProductCard";

const SortableProductCard = ({ p, reordering, isAdmin, categoriesMap, onCardClick, onEdit, onDelete, onToggleActive }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.productId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const className = `ro-sortable${reordering ? " ro-wobble" : ""}${isDragging ? " ro-dragging" : ""}`;

  return (
    <ProductCard
      p={p}
      isAdmin={isAdmin}
      categoriesMap={categoriesMap}
      dataScrollId={p.productId}
      onCardClick={() => onCardClick(p)}
      onEdit={() => onEdit(p)}
      onDelete={() => onDelete(p)}
      onToggleActive={(v) => onToggleActive(p, v)}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableClassName={className}
      sortableAttributes={attributes}
      sortableListeners={listeners}
      clickGuard={reordering}
    />
  );
};

export default SortableProductCard;
