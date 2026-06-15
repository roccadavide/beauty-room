import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ServiceCard from "./ServiceCard";

const SortableServiceCard = ({ s, reordering, isAdmin, categoriesMap, selectedId, onTileTap, onCardClick, onEdit, onDelete, onToggleActive }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.serviceId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const isSelected = selectedId === s.serviceId;
  const className = `ro-sortable${reordering ? " ro-wobble ro-compact" : ""}${isDragging ? " ro-dragging" : ""}`;

  return (
    <ServiceCard
      s={s}
      isAdmin={isAdmin}
      categoriesMap={categoriesMap}
      dataScrollId={s.serviceId}
      reordering={reordering}
      isSelected={isSelected}
      onTileTap={() => onTileTap(s.serviceId)}
      onCardClick={() => onCardClick(s)}
      onEdit={() => onEdit(s)}
      onDelete={() => onDelete(s)}
      onToggleActive={(v) => onToggleActive(s, v)}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableClassName={className}
      sortableAttributes={attributes}
      sortableListeners={listeners}
    />
  );
};

export default SortableServiceCard;
