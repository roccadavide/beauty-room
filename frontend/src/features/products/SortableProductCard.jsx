import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ProductCard from "./ProductCard";

const SortableProductCard = ({ p, reordering, isAdmin, categoriesMap, selectedId, onTileTap, onCardClick, onEdit, onDelete, onToggleActive }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.productId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const isSelected = selectedId === p.productId;
  const className = `ro-sortable${reordering ? " ro-wobble ro-compact" : ""}${isDragging ? " ro-dragging" : ""}`;

  return (
    <ProductCard
      p={p}
      isAdmin={isAdmin}
      categoriesMap={categoriesMap}
      dataScrollId={p.productId}
      reordering={reordering}
      isSelected={isSelected}
      onTileTap={() => onTileTap(p.productId)}
      onCardClick={() => onCardClick(p)}
      onEdit={() => onEdit(p)}
      onDelete={() => onDelete(p)}
      onToggleActive={(v) => onToggleActive(p, v)}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableClassName={className}
      sortableAttributes={attributes}
      sortableListeners={listeners}
    />
  );
};

export default SortableProductCard;
