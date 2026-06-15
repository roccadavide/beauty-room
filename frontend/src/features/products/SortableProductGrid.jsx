import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Container, Row } from "react-bootstrap";
import { DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import ProductCard from "./ProductCard";
import SortableProductCard from "./SortableProductCard";

const SortableProductGrid = ({ products, reorderEnabled, isAdmin, categoriesMap, onCardClick, onEdit, onDelete, onToggleActive, onReorderSave }) => {
  const [items, setItems] = useState(products);
  const [reordering, setReordering] = useState(false);
  const [saving, setSaving] = useState(false);
  const originalRef = useRef(products);

  // Resync from parent ONLY when not actively reordering, so an in-progress
  // drag session is never clobbered by upstream changes (filters, like counts).
  useEffect(() => {
    if (!reordering) {
      setItems(products);
      originalRef.current = products;
    }
  }, [products, reordering]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 12 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = () => {
    if (!reordering) {
      setReordering(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
    }
  };

  const handleDragEnd = event => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems(prev => {
      const oldIndex = prev.findIndex(x => x.productId === active.id);
      const newIndex = prev.findIndex(x => x.productId === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onReorderSave(items);
      setReordering(false);
    } catch (err) {
      alert("Errore nel salvataggio dell'ordine: " + (err?.message || "riprova"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setItems(originalRef.current);
    setReordering(false);
  };

  // Filters active → reorder disabled → plain, non-draggable grid (no DndContext).
  if (!reorderEnabled) {
    return (
      <Container fluid="xxl">
        <Row className="g-4 g-xl-5">
          {products.map(p => (
            <ProductCard
              key={p.productId}
              p={p}
              isAdmin={isAdmin}
              categoriesMap={categoriesMap}
              dataScrollId={p.productId}
              onCardClick={() => onCardClick(p)}
              onEdit={() => onEdit(p)}
              onDelete={() => onDelete(p)}
              onToggleActive={v => onToggleActive(p, v)}
            />
          ))}
        </Row>
      </Container>
    );
  }

  return (
    <>
      <Container fluid="xxl">
        <div data-lenis-prevent={reordering ? "" : undefined}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            autoScroll={{ threshold: { x: 0, y: 0.2 } }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map(p => p.productId)} strategy={rectSortingStrategy}>
              <Row className="g-4 g-xl-5">
                {items.map(p => (
                  <SortableProductCard
                    key={p.productId}
                    p={p}
                    reordering={reordering}
                    isAdmin={isAdmin}
                    categoriesMap={categoriesMap}
                    onCardClick={onCardClick}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleActive={onToggleActive}
                  />
                ))}
              </Row>
            </SortableContext>
          </DndContext>
        </div>
      </Container>

      {reordering &&
        createPortal(
          <div className="ro-bar" role="region" aria-label="Riordino prodotti">
            <span className="ro-bar-label">Trascina per riordinare · {items.length} prodotti</span>
            <div className="ro-bar-actions">
              <button className="ro-bar-cancel" onClick={handleCancel} disabled={saving}>
                Annulla
              </button>
              <button className="ro-bar-save" onClick={handleSave} disabled={saving}>
                {saving ? "Salvataggio…" : "Salva ordine"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default SortableProductGrid;
