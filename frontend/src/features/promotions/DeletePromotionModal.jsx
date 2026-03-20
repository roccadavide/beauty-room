// Migrated to ConfirmDialog — 2026-03-20 — see _unified-drawer.css
import ConfirmDialog from "../../components/common/ConfirmDialog";

const DeletePromotionModal = ({ show, onHide, promotion, onConfirm }) => (
  <ConfirmDialog
    show={show && Boolean(promotion)}
    onHide={onHide}
    onConfirm={() => onConfirm(promotion?.promotionId)}
    title="Elimina promozione"
    message={`Sei sicuro di voler eliminare "${promotion?.title}"? L'azione è irreversibile.`}
    confirmLabel="Elimina"
    confirmVariant="danger"
  />
);

export default DeletePromotionModal;
