import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Container, Row } from "react-bootstrap";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import ServiceCard from "./ServiceCard";
import SortableServiceCard from "./SortableServiceCard";

const SortableServiceGrid = ({
  services,
  reorderEnabled,
  isAdmin,
  categoriesMap,
  onCardClick,
  onEdit,
  onDelete,
  onToggleActive,
  onReorderSave,
}) => {
  const [items, setItems] = useState(services);
  const [reordering, setReordering] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const originalRef = useRef(services);

  // Resync from parent only when NOT actively reordering.
  useEffect(() => {
    if (!reordering) {
      setItems(services);
      originalRef.current = services;
    }
  }, [services, reordering]);

  // If filters get applied while reordering, exit reorder mode safely.
  useEffect(() => {
    if (!reorderEnabled && reordering) {
      setReordering(false);
      setSelectedId(null);
      setItems(services);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorderEnabled]);

  // Mouse drag only (handle). No TouchSensor: on touch we use tap-to-move,
  // which is immune to Lenis. MouseSensor still drives mouse + iPad-mouse drag.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = () => {
    setSelectedId(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((x) => x.serviceId === active.id);
      const newIndex = prev.findIndex((x) => x.serviceId === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  // Tap-to-move: tap a tile to pick it up, tap another to drop it there (insert).
  const handleTileTap = (id) => {
    if (selectedId == null) {
      setSelectedId(id);
    } else if (selectedId === id) {
      setSelectedId(null);
    } else {
      setItems((prev) => {
        const from = prev.findIndex((x) => x.serviceId === selectedId);
        const to = prev.findIndex((x) => x.serviceId === id);
        if (from === -1 || to === -1) return prev;
        return arrayMove(prev, from, to);
      });
      setSelectedId(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onReorderSave(items);
      setSelectedId(null);
      setReordering(false);
    } catch (err) {
      alert("Errore nel salvataggio dell'ordine: " + (err?.message || "riprova"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setItems(originalRef.current);
    setSelectedId(null);
    setReordering(false);
  };

  // Filters active → plain non-draggable grid.
  if (!reorderEnabled) {
    return (
      <Container fluid="xxl">
        <Row className="g-4 g-xl-5">
          {services.map((s) => (
            <ServiceCard
              key={s.serviceId}
              s={s}
              isAdmin={isAdmin}
              categoriesMap={categoriesMap}
              dataScrollId={s.serviceId}
              onCardClick={() => onCardClick(s)}
              onEdit={() => onEdit(s)}
              onDelete={() => onDelete(s)}
              onToggleActive={(v) => onToggleActive(s, v)}
            />
          ))}
        </Row>
      </Container>
    );
  }

  return (
    <>
      {!reordering && (
        <div className="ro-trigger-wrap">
          <button type="button" className="ro-trigger-btn" onClick={() => setReordering(true)}>
            <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden="true">
              <g fill="currentColor">
                <circle cx="8" cy="5" r="1.5" /><circle cx="8" cy="11" r="1.5" /><circle cx="8" cy="17" r="1.5" />
                <circle cx="14" cy="5" r="1.5" /><circle cx="14" cy="11" r="1.5" /><circle cx="14" cy="17" r="1.5" />
              </g>
            </svg>
            Riordina trattamenti
          </button>
        </div>
      )}

      {reordering && (
        <p className="ro-help-note">
          Tocca la card da spostare, poi tocca dove vuoi metterla. Col mouse puoi anche trascinare dalla maniglia.
        </p>
      )}

      <Container fluid="xxl">
        <div data-lenis-prevent="">
          {reordering ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              autoScroll={{ threshold: { x: 0, y: 0.2 } }}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={items.map((s) => s.serviceId)} strategy={rectSortingStrategy}>
                <Row className="g-3">
                  {items.map((s) => (
                    <SortableServiceCard
                      key={s.serviceId}
                      s={s}
                      reordering
                      isAdmin={isAdmin}
                      categoriesMap={categoriesMap}
                      selectedId={selectedId}
                      onTileTap={handleTileTap}
                      onCardClick={onCardClick}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onToggleActive={onToggleActive}
                    />
                  ))}
                </Row>
              </SortableContext>
            </DndContext>
          ) : (
            <Row className="g-4 g-xl-5">
              {items.map((s) => (
                <ServiceCard
                  key={s.serviceId}
                  s={s}
                  isAdmin={isAdmin}
                  categoriesMap={categoriesMap}
                  dataScrollId={s.serviceId}
                  onCardClick={() => onCardClick(s)}
                  onEdit={() => onEdit(s)}
                  onDelete={() => onDelete(s)}
                  onToggleActive={(v) => onToggleActive(s, v)}
                />
              ))}
            </Row>
          )}
        </div>
      </Container>

      {reordering && createPortal(
        <div className="ro-bar" role="region" aria-label="Riordino trattamenti">
          <span className="ro-bar-label">
            {selectedId ? "Tocca la card di destinazione" : `Tocca una card, poi la destinazione · ${items.length} trattamenti`}
          </span>
          <div className="ro-bar-actions">
            <button className="ro-bar-cancel" onClick={handleCancel} disabled={saving}>
              Annulla
            </button>
            <button className="ro-bar-save" onClick={handleSave} disabled={saving}>
              {saving ? "Salvataggio…" : "Salva ordine"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SortableServiceGrid;
